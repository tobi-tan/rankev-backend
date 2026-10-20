// ẢNH THẬT cho các trận kinh điển — tất cả từ Wikimedia Commons, giấy phép mở (CC0 / Public domain /
// CC BY / CC BY-SA), có tác giả để GHI NGUỒN (dòng "📷 Ảnh:" cuối mô tả mỗi bài). Sinh tự động từ API
// Commons (license + artist lấy từ extmetadata). Trận có nhân vật/thương hiệu (Tom & Jerry, Doraemon/
// Conan, iPhone/Android) cố ý giữ emoji vì bản quyền/nhãn hiệu.
export interface ClassicImage { url: string; artist: string; license: string }
export const CLASSIC_IMAGES: Record<string, { a: ClassicImage; b: ClassicImage }> = {
  "Phở hay Bún chả?": {
    a: { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/96/Pho-Beef-Noodle-Soup-2008.jpg/960px-Pho-Beef-Noodle-Soup-2008.jpg", artist: "Kham Tran", license: "CC BY-SA 3.0" },
    b: { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7f/Bun-cha-hanoi.jpg/960px-Bun-cha-hanoi.jpg", artist: "Valentin Orange", license: "CC BY-SA 4.0" },
  },
  "Messi hay Ronaldo?": {
    a: { url: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Lionel_Messi_20180626.jpg", artist: "Кирилл Венедиктов", license: "CC BY-SA 3.0" },
    b: { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Argentine_-_Portugal_-_Cristiano_Ronaldo.jpg/960px-Argentine_-_Portugal_-_Cristiano_Ronaldo.jpg", artist: "Ludovic Péron", license: "CC BY-SA 3.0" },
  },
  "Mèo hay Chó?": {
    a: { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bd/Close-up_portrait_of_a_domestic_cat%2C_gazing_upwards.jpg/960px-Close-up_portrait_of_a_domestic_cat%2C_gazing_upwards.jpg", artist: "Godwin Borg", license: "CC BY-SA 4.0" },
    b: { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/Cute_white_fluffy_dog_close_up_portrait.jpg/960px-Cute_white_fluffy_dog_close_up_portrait.jpg", artist: "Karthikasiva03", license: "CC BY 4.0" },
  },
  "Cà phê sữa đá hay Trà sữa?": {
    a: { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Vietnamese_Iced_Coffee_Ba_Chi_Canteen.jpg/960px-Vietnamese_Iced_Coffee_Ba_Chi_Canteen.jpg", artist: "Infrogmation of New Orleans", license: "CC BY 2.0" },
    b: { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5b/2009-12-30_cups_of_bubble_tea_at_a_Chunshuitang_in_Taipei.jpg/960px-2009-12-30_cups_of_bubble_tea_at_a_Chunshuitang_in_Taipei.jpg", artist: "takuma mori", license: "CC BY 2.0" },
  },
  "Hà Nội hay Sài Gòn?": {
    a: { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4d/Hanoi_-_Turtle_Tower_%28Th%C3%A1p_R%C3%B9a%29%2C_Ho%C3%A0n_Ki%E1%BA%BFm_Lake.jpg/960px-Hanoi_-_Turtle_Tower_%28Th%C3%A1p_R%C3%B9a%29%2C_Ho%C3%A0n_Ki%E1%BA%BFm_Lake.jpg", artist: "P. Hughes", license: "CC BY 4.0" },
    b: { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/08/Ho_Chi_Minh_City_Skyline_at_Night.jpg/960px-Ho_Chi_Minh_City_Skyline_at_Night.jpg", artist: "Tran Van Ngoc", license: "CC0" },
  },


  "Bánh mì hay Xôi?": {
    a: { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/B%C3%A1nh_mi_Sandwich%28Takadanobaba%29IMG_20220215_104413_03.jpg/960px-B%C3%A1nh_mi_Sandwich%28Takadanobaba%29IMG_20220215_104413_03.jpg", artist: "経済特区", license: "CC BY-SA 4.0" },
    b: { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/af/X%C3%B4i_n%E1%BA%BFp_c%E1%BA%A9m%EF%BC%88Quay_phim_t%E1%BA%A1i_Khe_R%E1%BA%A1n%2CCon_Cu%C3%B4ng%2CNgh%E1%BB%87_An%EF%BC%89.jpg/960px-X%C3%B4i_n%E1%BA%BFp_c%E1%BA%A9m%EF%BC%88Quay_phim_t%E1%BA%A1i_Khe_R%E1%BA%A1n%2CCon_Cu%C3%B4ng%2CNgh%E1%BB%87_An%EF%BC%89.jpg", artist: "KoheiU", license: "CC0" },
  },
  "Nhắn tin hay Gọi điện?": {
    a: { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Woman_texting_on_a_smartphone.jpg/960px-Woman_texting_on_a_smartphone.jpg", artist: "Kristin Hardwick", license: "CC0" },
    b: { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b5/A_young_girl_stands_talking_on_a_mobile_phone._%2810664773983%29.jpg/960px-A_young_girl_stands_talking_on_a_mobile_phone._%2810664773983%29.jpg", artist: "Irene Scott/AusAID", license: "CC BY 2.0" },
  },
  "Lên văn phòng hay Làm từ xa?": {
    a: { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c8/OpenPlanRedBalloon1.jpg/960px-OpenPlanRedBalloon1.jpg", artist: "VeronicaTherese", license: "CC BY-SA 3.0" },
    b: { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/Working_from_Bed_-_A_Man_Works_from_Home_with_a_Laptop_in_Bed.jpg/960px-Working_from_Bed_-_A_Man_Works_from_Home_with_a_Laptop_in_Bed.jpg", artist: "Microbiz Mag", license: "CC BY 2.0" },
  },
  "Tết về quê hay Tết đi du lịch?": {
    a: { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ad/Banh_chung_vuong_2.JPG/960px-Banh_chung_vuong_2.JPG", artist: "Viethavvh at vi.wikipedia", license: "Public domain" },
    b: { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9f/Sunset_view_from_an_airplane_window_above_the_clouds.jpg/960px-Sunset_view_from_an_airplane_window_above_the_clouds.jpg", artist: "Salwa Farwaneh Dameh", license: "CC0" },
  },


};
