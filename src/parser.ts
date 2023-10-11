import axios, { type AxiosInstance } from "axios";
import { ethers, JsonRpcProvider, Transaction } from "ethers";
import { getSyncedBlock, setSyncedBlock } from "./utils/cache";
import constants from "./utils/constants";
import { sendFirstBuyToDiscord } from "./utils/discord";
import { chunks } from "./utils/helpers";
import logger from "./utils/logger";
import { RPCMethod } from "./utils/types";

/**
 * Sleep for period of time
 * @param {number} ms milliseconds to sleep
 * @returns {Promise} resolves when sleep period finished
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default class TxParser {
  private latestSyncedBlock: number | undefined;
  private rpcProvider: JsonRpcProvider;
  private rpc: AxiosInstance;

  /**
   * @param {string} rpcUrl Base RPC
   */
  constructor(rpcUrl: string) {
    this.rpcProvider = new JsonRpcProvider(rpcUrl);
    this.rpc = axios.create({
      baseURL: rpcUrl,
    });
  }

  /**
   * Chunks batch data request processing to avoid 1K request limit
   * @param {RPCMethod[]} batch to execute
   */
  async chunkTxCall(batch: RPCMethod[]) {
    let txData: {
      result: {
        transactionHash: string;
        status: "0x0" | "0x1";
      };
    }[] = [];

    // Execute batch data request in chunks of 950
    for (const chunk of [...chunks(batch, 950)]) {
      // Execute request for batch tx data
      const {
        data,
      }: {
        data: {
          result: {
            transactionHash: string;
            status: "0x0" | "0x1";
          };
        }[];
      } = await this.rpc.post("/", chunk);

      txData.push(...data);
    }

    // Return tx data
    return txData;
  }

  async getChainBlock(): Promise<number> {
    try {
      const blockNumber = await this.rpcProvider.getBlockNumber();
      return Number(blockNumber);
    } catch {
      logger.error("Failed to collect chain head number");
      throw new Error("Could not collect chain head number");
    }
  }

  async getSyncedBlockNumber(): Promise<number> {
    if (this.latestSyncedBlock) return this.latestSyncedBlock;
    return getSyncedBlock();
  }

  /**
   * Send discord notifications in batches so as to bypass
   * webhook ratelimits. Can use some TLC and optimizations
   * @param firstBuyTxs list of first-key buy txs
   */
  async handleFirstBuyTxs(firstBuyTxs: Transaction[]) {
    for (const chunk of [
      ...chunks(firstBuyTxs, constants.DISCORD_NOTIFICATIONS_BATCH_SIZE),
    ]) {
      const promises = chunk.map(async (tx) => {
        await sendFirstBuyToDiscord(tx);
      });
      await Promise.all(promises);
      await sleep(100);
    }
  }

  async syncTxsInRange(startBlock: number, endBlock: number) {
    // Create block + transaction collection requests
    const numBlocks: number = endBlock - startBlock;
    logger.info(`Collecting ${numBlocks} blocks: ${startBlock} -> ${endBlock}`);

    // Create batch requests array
    const batchBlockRequests: RPCMethod[] = new Array(numBlocks)
      .fill(0)
      .map((_, i: number) => ({
        method: "eth_getBlockByNumber",
        // Hex block number, true => return all transactions
        params: [`0x${(startBlock + i).toString(16)}`, true],
        id: i,
        jsonrpc: "2.0",
      }));

    // Execute request for batch blocks + transactions
    const { data: blockData } = await this.rpc.post("/", batchBlockRequests);
    const contractAddress: string = constants.CONTRACT_ADDRESS.toLowerCase();

    const firstBuyTxs = [];
    for (const block of blockData) {
      for (const tx of block.result.transactions) {
        if (
          // If transaction is to contract
          tx.to === contractAddress &&
          // And, transaction is of format buyShares
          constants.SIGNATURES.BUY == tx.input.slice(0, 10)
        ) {
          try {
            const result = ethers.AbiCoder.defaultAbiCoder().decode(
              ["address", "uint256"],
              ethers.dataSlice(tx.input, 4)
            );
            const subject = result[0].toLowerCase();
            const amount = result[1];
            // ensure that this tx is for the first key purchase
            if (
              tx.from === subject &&
              amount === BigInt(1) &&
              tx.value === "0x0"
            ) {
              firstBuyTxs.push(tx);
            }
          } catch (e: any) {
            if (e.message.includes("data out-of-bounds")) {
              // skip the error because it's an invalid/failed tx
              // we could also get tx receipts and filter that
              // way but that would require more RPC calls and
              // slow down processing, so here, I'm essentially
              // assuming that all first-buy txs with "valid"
              // calldata actually succeeded
              continue;
            }
            throw e;
          }
        }
      }
    }

    this.handleFirstBuyTxs(firstBuyTxs);
  }

  async syncTxs() {
    const latestChainBlock: number = await this.getChainBlock();
    let latestSyncedBlock: number = await this.getSyncedBlockNumber();
    // If we're too far off sync, then start syncing from only
    // 10k blocks back
    // You can remove this piece of logic if you are building
    // something that, say, tracks *all* trades. This is just
    // in place so we don't have to go over 100s of thousands
    // of Base blocks before we start parsing blocks in realtime
    if (latestChainBlock - latestSyncedBlock > 10000) {
      latestSyncedBlock = latestChainBlock - 10000;
      await setSyncedBlock(latestChainBlock);
    }

    // Calculate remaining blocks to sync
    const diffSync: number = latestChainBlock - latestSyncedBlock;
    logger.info(`Remaining blocks to sync: ${diffSync}`);

    // If diff > 0, poll by 100 blocks at a time
    if (diffSync > 0) {
      // Max 100 blocks to collect
      const numToSync: number = Math.min(diffSync, 100);

      // (start, end) sync blocks
      let startBlock: number = latestSyncedBlock;
      let endBlock: number = latestSyncedBlock + numToSync;

      // Sync between block ranges
      try {
        // Sync start -> end blocks
        await this.syncTxsInRange(startBlock, endBlock);
        // Update last synced block
        await setSyncedBlock(endBlock);
        this.latestSyncedBlock = endBlock;
      } catch (e) {
        logger.error("Error when syncing between range", e);
      }
    }
  }

  async sync() {
    await this.syncTxs();

    logger.info("Sleeping TxSync for 500ms");
    setTimeout(() => this.sync(), 500);
  }
}
