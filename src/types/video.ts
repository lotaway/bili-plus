// Video data interface based on Bilibili video page structure
export interface Page {
  cid: number;
  page: number;
  from: string;
  part: string;
  duration: number;
  vid: string;
  weblink: string;
  dimension: {
    width: number;
    height: number;
    rotate: number;
  };
}

export interface Author {
  mid: number;
  name: string;
  face: string;
  sign?: string;
  rank?: number;
  birthday?: number;
  is_fake_account?: number;
  is_deleted?: number;
  in_reg_audit?: number;
  is_senior_member?: number;
  name_render?: string | null;
  handle?: string;
}

export interface VideoStat {
  aid: number;
  view: number;
  danmaku: number;
  reply: number;
  fav: number;
  coin: number;
  share: number;
  now_rank: number;
  his_rank: number;
  like: number;
  dislike?: number;
  evaluation?: string;
  argue_msg?: string;
  vt: number;
  vv: number;
}

export interface SubtitleItem {
  id: number;
  lan: string;
  lan_doc: string;
  is_lock: boolean;
  subtitle_url: string;
  type: number;
  id_str: string;
  ai_type: number;
  ai_status: number;
  subtitle_height: number | null;
  author: Author;
}

export interface Subtitle {
  allow_submit: boolean;
  list: SubtitleItem[];
}

export interface EmbedPlayer {
  p: number;
  aid: number;
  bvid: string;
  cid: number;
  vid: string;
  vtype: string;
  stats: {
    spmId: string;
    spmIdFrom: string;
  };
  t: number;
  fromDid: string | null;
  featureList: Record<string, unknown>;
}

export interface VideoData {
  // Basic video info
  aid?: number;
  cid?: number;
  bvid?: string;
  p?: number;
  pages?: Page[];
  title?: string;
  
  // Extended info from example.data.json
  pic?: string;
  desc?: string;
  duration?: number;
  pubdate?: number;
  ctime?: number;
  copyright?: number;
  type_id?: number;
  type_name?: string;
  state?: number;
  rights?: {
    bp: number;
    elec: number;
    download: number;
    movie: number;
    pay: number;
    hd5: number;
    no_reprint: number;
    autoplay: number;
    ugc_pay: number;
    is_cooperation: number;
    ugc_pay_preview: number;
    arc_pay: number;
    free_watch: number;
  };
  
  // Author info
  owner?: Author;
  author?: Author;
  
  // Statistics
  stat?: VideoStat;
  
  // Subtitle info
  subtitle?: Subtitle;
  
  // Player info
  embedPlayer?: EmbedPlayer;
  
  // Additional fields
  dynamic?: string;
  dimension?: {
    width: number;
    height: number;
    rotate: number;
  };
  desc_v2?: string | null;
  is_chargeable_season?: boolean;
  is_blooper?: boolean;
  enable_vt?: number;
  vt_display?: string;
  type_id_v2?: number;
  type_name_v2?: string;
  is_lesson_video?: number;
  
  // Season info (if applicable)
  ugc_season?: {
    id: number;
    title: string;
    cover: string;
    mid: number;
    intro: string;
    sign_state: number;
    attribute: number;
    sections: Array<{
      season_id: number;
      id: number;
      title: string;
      type: number;
      episodes: Array<{
        season_id: number;
        section_id: number;
        id: number;
        aid: number;
        cid: number;
        title: string;
        attribute: number;
        arc: any;
        page: Page;
        bvid: string;
        pages: Page[];
      }>;
    }>;
  };
  
  // Other fields
  is_season_display?: boolean;
  user_garb?: {
    url_image_ani_cut: string;
  };
  honor_reply?: Record<string, unknown>;
  like_icon?: string;
  need_jump_bv?: boolean;
  disable_show_up_info?: boolean;
  is_story_play?: number;
  is_view_self?: boolean;
}
