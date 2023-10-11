/**
 * JSONRPC method
 */
export type RPCMethod = {
  id: number;
  jsonrpc: string;
  params: any[];
  method: string;
};

/**
 * Transformed transaction
 */
export type Transaction = {
  hash: string;
  timestamp: number;
  blockNumber: number;
  from: string;
  subject: string;
  isBuy: boolean;
  amount: number;
  cost: number;
  value: string;
};

export type CustomTwitterUser = {
  username: string;
  name: string;
  description: string;
  followersCount: number;
  friendsCount: number;
  numLikes: number;
  numPosts: number;
  numLists: number;
  createdAt: Date;
  verified: boolean;
  default: boolean;
  profileImageUrl: string;
};

export type TwitterUser = {
  id: number;
  id_str: string;
  name: string;
  screen_name: string;
  location: string;
  description: string;
  url: string | null;
  entities: {
    description: {
      urls: any[];
    };
  };
  protected: boolean;
  followers_count: number;
  friends_count: number;
  listed_count: number;
  created_at: string;
  favourites_count: number;
  verified: boolean;
  statuses_count: number;
  profile_background_tile: boolean;
  profile_image_url: string;
  profile_image_url_https: string;
  profile_banner_url: string;
  profile_link_color: string;
  profile_sidebar_border_color: string;
  profile_sidebar_fill_color: string;
  profile_text_color: string;
  profile_use_background_image: boolean;
  has_extended_profile: boolean;
  default_profile: boolean;
  default_profile_image: boolean;
  following: any | null;
  follow_request_sent: any | null;
  notifications: any | null;
  translator_type: string;
  withheld_in_countries: any[];
};
