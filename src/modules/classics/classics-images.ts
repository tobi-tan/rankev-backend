// ẢNH THẬT cho các trận kinh điển. Ưu tiên Unsplash (đẹp, giấy phép Unsplash: dùng thương mại, KHÔNG bắt
// ghi nguồn — license "Unsplash"); chỗ Unsplash không có (Messi/Ronaldo, Xôi) dùng Wikimedia Commons
// (CC BY / BY-SA → GHI NGUỒN ở dòng "📷 Ảnh:" cuối mô tả). Nhân vật/thương hiệu (Tom & Jerry, Doraemon/
// Conan, iPhone/Android) còn emoji — chủ app tự thay ảnh khi đăng nhập @rankev.
export interface ClassicImage { url: string; artist: string; license: string }
export const CLASSIC_IMAGES: Record<string, { a: ClassicImage; b: ClassicImage }> = {
  "Phở hay Bún chả?": {
    a: { url: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=1080&q=80&auto=format&fit=crop", artist: "", license: "Unsplash" },
    b: { url: "https://images.unsplash.com/photo-1742893368398-128bded9c656?w=1080&q=80&auto=format&fit=crop", artist: "", license: "Unsplash" },
  },

  "Messi hay Ronaldo?": {
    a: { url: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Lionel_Messi_20180626.jpg", artist: "Кирилл Венедиктов", license: "CC BY-SA 3.0" },
    b: { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Argentine_-_Portugal_-_Cristiano_Ronaldo.jpg/960px-Argentine_-_Portugal_-_Cristiano_Ronaldo.jpg", artist: "Ludovic Péron", license: "CC BY-SA 3.0" },
  },
  "Mèo hay Chó?": {
    a: { url: "https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=1080&q=80&auto=format&fit=crop", artist: "", license: "Unsplash" },
    b: { url: "https://images.unsplash.com/photo-1764377720136-1128676a06bd?w=1080&q=80&auto=format&fit=crop", artist: "", license: "Unsplash" },
  },

  "Cà phê sữa đá hay Trà sữa?": {
    a: { url: "https://images.unsplash.com/photo-1662105489808-f3dd79b7f13c?w=1080&q=80&auto=format&fit=crop", artist: "", license: "Unsplash" },
    b: { url: "https://images.unsplash.com/photo-1558857563-b371033873b8?w=1080&q=80&auto=format&fit=crop", artist: "", license: "Unsplash" },
  },

  "Hà Nội hay Sài Gòn?": {
    a: { url: "https://images.unsplash.com/photo-1678461863258-185d001d7a1b?w=1080&q=80&auto=format&fit=crop", artist: "", license: "Unsplash" },
    b: { url: "https://images.unsplash.com/photo-1761538367870-3a16b25f9bd3?w=1080&q=80&auto=format&fit=crop", artist: "", license: "Unsplash" },
  },



  "Bánh mì hay Xôi?": {
    a: { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/B%C3%A1nh_mi_Sandwich%28Takadanobaba%29IMG_20220215_104413_03.jpg/960px-B%C3%A1nh_mi_Sandwich%28Takadanobaba%29IMG_20220215_104413_03.jpg", artist: "経済特区", license: "CC BY-SA 4.0" },
    b: { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/af/X%C3%B4i_n%E1%BA%BFp_c%E1%BA%A9m%EF%BC%88Quay_phim_t%E1%BA%A1i_Khe_R%E1%BA%A1n%2CCon_Cu%C3%B4ng%2CNgh%E1%BB%87_An%EF%BC%89.jpg/960px-X%C3%B4i_n%E1%BA%BFp_c%E1%BA%A9m%EF%BC%88Quay_phim_t%E1%BA%A1i_Khe_R%E1%BA%A1n%2CCon_Cu%C3%B4ng%2CNgh%E1%BB%87_An%EF%BC%89.jpg", artist: "KoheiU", license: "CC0" },
  },
  "Nhắn tin hay Gọi điện?": {
    a: { url: "https://images.unsplash.com/photo-1758273706077-cd89007983e8?w=1080&q=80&auto=format&fit=crop", artist: "", license: "Unsplash" },
    b: { url: "https://images.unsplash.com/photo-1758876201450-cf77ab8b95bc?w=1080&q=80&auto=format&fit=crop", artist: "", license: "Unsplash" },
  },

  "Lên văn phòng hay Làm từ xa?": {
    a: { url: "https://images.unsplash.com/photo-1758691737138-7b9b1884b1db?w=1080&q=80&auto=format&fit=crop", artist: "", license: "Unsplash" },
    b: { url: "https://images.unsplash.com/photo-1773332598414-44a45e364d85?w=1080&q=80&auto=format&fit=crop", artist: "", license: "Unsplash" },
  },

  "Tết về quê hay Tết đi du lịch?": {
    a: { url: "https://images.unsplash.com/photo-1769488215147-65ca0bd828c6?w=1080&q=80&auto=format&fit=crop", artist: "", license: "Unsplash" },
    b: { url: "https://images.unsplash.com/photo-1603792835233-f4f7c2497d4f?w=1080&q=80&auto=format&fit=crop", artist: "", license: "Unsplash" },
  },



};
