// NỘI DUNG MẪU của @rankev (sinh tự động từ scratchpad/unsplash/showcase.cjs — ảnh Unsplash, không cần ghi nguồn).
// • Path học đường Nhật Bản nhiều nhánh (ảnh tạm: ảnh chụp Nhật Bản — thay bằng ảnh anime khi có).
// • Đề thi thử THPT môn Toán 40 câu (0,25 điểm/câu, 90 phút) — đề tự soạn theo cấu trúc đề thi.
// • Khảo sát WHO-5 (WHO, dùng tự do) — khảo sát cộng đồng, không phải chẩn đoán.
export const SHOWCASE_PATH = {
  "type": "path",
  "title": "Ngày đầu ở trường Sakuragaoka 🌸",
  "caption": "Truyện tương tác học đường Nhật Bản: 7 cảnh, 6 cái kết khác nhau. Ở mỗi cảnh, chạm vào bức ảnh để chọn — bạn sẽ không biết lựa chọn đó dẫn tới đâu cho tới cuối. Chơi lại để mở hết các kết!",
  "tags": [
    "kinhdien",
    "truyentuongtac",
    "nhatban"
  ],
  "media": {
    "url": "https://rankev-web.vercel.app/classics/sakura/cover.webp",
    "type": "image"
  },
  "revealMode": "hidden",
  "hideEndingCount": false,
  "allowGuestPresent": true,
  "questions": [
    {
      "key": "s1",
      "isEntry": true,
      "sceneImageUrl": "https://rankev-web.vercel.app/classics/sakura/s1.webp",
      "text": "Sáng đầu tiên ở trường cao trung Sakuragaoka. Hoa anh đào rơi kín cổng trường, chuông vào lớp sắp reo. Bạn sẽ…",
      "answers": [
        {
          "label": "Chạy vội vào lớp kẻo trễ",
          "imageUrl": "https://rankev-web.vercel.app/classics/sakura/s1-a1.webp",
          "targetType": "question",
          "targetKey": "s2"
        },
        {
          "label": "Nhặt chiếc khăn tay ai đó đánh rơi",
          "imageUrl": "https://rankev-web.vercel.app/classics/sakura/s1-a2.webp",
          "targetType": "question",
          "targetKey": "s3"
        },
        {
          "label": "Lẻn ra sau trường khám phá",
          "imageUrl": "https://rankev-web.vercel.app/classics/sakura/s1-a3.webp",
          "targetType": "question",
          "targetKey": "s4"
        }
      ]
    },
    {
      "key": "s2",
      "sceneImageUrl": "https://rankev-web.vercel.app/classics/sakura/s2.webp",
      "text": "Bạn lao vào lớp đúng lúc chuông reo… và va phải Kaito — lớp trưởng nổi tiếng nghiêm khắc. Sách vở của cậu ấy rơi tung toé.",
      "answers": [
        {
          "label": "Xin lỗi rối rít, giúp nhặt sách",
          "imageUrl": "https://rankev-web.vercel.app/classics/sakura/s2-a1.webp",
          "targetType": "question",
          "targetKey": "s5"
        },
        {
          "label": "Cười trừ rồi chuồn về chỗ cạnh cửa sổ",
          "imageUrl": "https://rankev-web.vercel.app/classics/sakura/s2-a2.webp",
          "targetType": "question",
          "targetKey": "s6"
        }
      ]
    },
    {
      "key": "s3",
      "sceneImageUrl": "https://rankev-web.vercel.app/classics/sakura/s3.webp",
      "text": "Chủ chiếc khăn là Hana, cô bạn lớp bên. Đó là món quà của bà cô ấy, Hana đã tìm khắp sân trường.",
      "answers": [
        {
          "label": "Trả khăn và rủ Hana ăn trưa cùng",
          "imageUrl": "https://rankev-web.vercel.app/classics/sakura/s3-a1.webp",
          "targetType": "question",
          "targetKey": "s6"
        },
        {
          "label": "Trả khăn rồi chạy vội vào lớp",
          "imageUrl": "https://rankev-web.vercel.app/classics/sakura/s3-a2.webp",
          "targetType": "question",
          "targetKey": "s5"
        }
      ]
    },
    {
      "key": "s4",
      "sceneImageUrl": "https://rankev-web.vercel.app/classics/sakura/s4.webp",
      "text": "Phía sau trường có tiếng đàn vọng ra từ phòng câu lạc bộ âm nhạc. Trên mái nhà kho, một con mèo đen đang nhìn bạn chằm chằm.",
      "answers": [
        {
          "label": "Gõ cửa câu lạc bộ âm nhạc",
          "imageUrl": "https://rankev-web.vercel.app/classics/sakura/s4-a1.webp",
          "targetType": "ending",
          "targetKey": "Ngôi sao lễ hội"
        },
        {
          "label": "Đi theo con mèo đen",
          "imageUrl": "https://rankev-web.vercel.app/classics/sakura/s4-a2.webp",
          "targetType": "question",
          "targetKey": "s7"
        }
      ]
    },
    {
      "key": "s5",
      "sceneImageUrl": "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1080&q=80&auto=format&fit=crop",
      "text": "Giờ nghỉ trưa, Kaito tìm tới bàn bạn: “Hội học sinh đang thiếu người chuẩn bị lễ hội trường. Cậu tham gia không?”",
      "answers": [
        {
          "label": "Nhận lời ngay",
          "imageUrl": "https://images.unsplash.com/photo-1620287920810-3f5b9746380c?w=1080&q=80&auto=format&fit=crop",
          "targetType": "ending",
          "targetKey": "Lớp trưởng tương lai"
        },
        {
          "label": "Từ chối, ra sân bóng với hội con trai",
          "imageUrl": "https://images.unsplash.com/photo-1631405234894-f3224573c864?w=1080&q=80&auto=format&fit=crop",
          "targetType": "ending",
          "targetKey": "Ngôi sao sân cỏ"
        }
      ]
    },
    {
      "key": "s6",
      "sceneImageUrl": "https://images.unsplash.com/photo-1638537197225-bab0fb9b15bf?w=1080&q=80&auto=format&fit=crop",
      "text": "Trên sân thượng lúc hoàng hôn, Hana chia cho bạn nửa hộp bento và kể về lễ hội pháo hoa cuối tuần này.",
      "answers": [
        {
          "label": "Hẹn Hana cùng đi xem pháo hoa",
          "imageUrl": "https://images.unsplash.com/photo-1665240571093-eb9be84fb182?w=1080&q=80&auto=format&fit=crop",
          "targetType": "ending",
          "targetKey": "Thanh xuân rực rỡ"
        },
        {
          "label": "Rủ cả lớp đi cùng cho vui",
          "imageUrl": "https://images.unsplash.com/photo-1500082166526-094992a72842?w=1080&q=80&auto=format&fit=crop",
          "targetType": "ending",
          "targetKey": "Linh hồn của lớp"
        }
      ]
    },
    {
      "key": "s7",
      "sceneImageUrl": "https://images.unsplash.com/photo-1556901596-44a003a4728d?w=1080&q=80&auto=format&fit=crop",
      "text": "Con mèo dẫn bạn tới một phòng học bỏ hoang. Trên bàn giáo viên là cuốn nhật ký cũ của một học sinh từ 30 năm trước.",
      "answers": [
        {
          "label": "Mở ra đọc",
          "imageUrl": "https://images.unsplash.com/photo-1654124803048-597350406baf?w=1080&q=80&auto=format&fit=crop",
          "targetType": "ending",
          "targetKey": "Người giữ bí mật"
        },
        {
          "label": "Mang tới cho thầy chủ nhiệm",
          "imageUrl": "https://images.unsplash.com/photo-1511629091441-ee46146481b6?w=1080&q=80&auto=format&fit=crop",
          "targetType": "ending",
          "targetKey": "Lớp trưởng tương lai"
        }
      ]
    }
  ],
  "endings": [
    {
      "name": "Ngôi sao lễ hội",
      "imageUrl": "https://rankev-web.vercel.app/classics/sakura/e1.webp",
      "comment": "Bạn trở thành guitar chính của ban nhạc trường và cháy hết mình ở lễ hội mùa thu. Cả trường gọi tên bạn!"
    },
    {
      "name": "Lớp trưởng tương lai",
      "imageUrl": "https://rankev-web.vercel.app/classics/sakura/e2.webp",
      "comment": "Chu đáo, có trách nhiệm — năm sau bạn chính là người dẫn dắt hội học sinh."
    },
    {
      "name": "Ngôi sao sân cỏ",
      "imageUrl": "https://rankev-web.vercel.app/classics/sakura/e3.webp",
      "comment": "Bạn ghi bàn quyết định ở giải bóng đá liên trường. Tuổi trẻ là phải chạy hết sức!"
    },
    {
      "name": "Thanh xuân rực rỡ",
      "imageUrl": "https://rankev-web.vercel.app/classics/sakura/e4.webp",
      "comment": "Dưới bầu trời pháo hoa, một tình bạn đặc biệt bắt đầu. Có những mùa hè nhớ cả đời."
    },
    {
      "name": "Linh hồn của lớp",
      "imageUrl": "https://rankev-web.vercel.app/classics/sakura/e5.webp",
      "comment": "Ở đâu có bạn, ở đó có tiếng cười. Cả lớp đều thân nhau hơn nhờ bạn."
    },
    {
      "name": "Người giữ bí mật",
      "imageUrl": "https://rankev-web.vercel.app/classics/sakura/e6.webp",
      "comment": "Cuốn nhật ký kể về một lời hứa chưa hoàn thành. Từ hôm nay, bạn là người giữ lời hứa ấy…"
    }
  ]
} as const;

export const SHOWCASE_EXAM = {
  "type": "deck",
  "deckMode": "exam",
  "title": "Đề thi thử THPT môn Toán — 40 câu",
  "caption": "Đề luyện thi tốt nghiệp THPT / xét tuyển đại học: 40 câu trắc nghiệm, 90 phút, mỗi câu 0,25 điểm (thang 10). Làm ngay trên điện thoại, nộp bài là biết điểm. Thầy cô có thể trình chiếu đề cho cả lớp làm qua mã QR.",
  "tags": [
    "dethi",
    "toan",
    "thpt"
  ],
  "media": {
    "url": "https://images.unsplash.com/photo-1630983358494-96012d838b84?w=1080&q=80&auto=format&fit=crop",
    "type": "image"
  },
  "passingScore": 5,
  "examDurationMinutes": 90,
  "allowGuestPresent": true,
  "questions": [
    {
      "text": "Câu 1. Cho hàm số y = x³ − 3x + 2. Hàm số đạt cực đại tại",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "x = 1"
        },
        {
          "label": "x = −1",
          "correct": true
        },
        {
          "label": "x = 0"
        },
        {
          "label": "x = 2"
        }
      ]
    },
    {
      "text": "Câu 2. Tiệm cận đứng của đồ thị hàm số y = (2x + 1)/(x − 1) là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "y = 2"
        },
        {
          "label": "x = −1"
        },
        {
          "label": "y = 1"
        },
        {
          "label": "x = 1",
          "correct": true
        }
      ]
    },
    {
      "text": "Câu 3. Tiệm cận ngang của đồ thị hàm số y = (2x + 1)/(x − 1) là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "y = 2",
          "correct": true
        },
        {
          "label": "x = 1"
        },
        {
          "label": "y = −1"
        },
        {
          "label": "y = 1/2"
        }
      ]
    },
    {
      "text": "Câu 4. Giá trị lớn nhất của hàm số f(x) = x³ − 3x² + 1 trên đoạn [−1; 1] là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "−1"
        },
        {
          "label": "−3"
        },
        {
          "label": "1",
          "correct": true
        },
        {
          "label": "3"
        }
      ]
    },
    {
      "text": "Câu 5. Hàm số y = x⁴ − 2x² có bao nhiêu điểm cực trị?",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "3",
          "correct": true
        },
        {
          "label": "1"
        },
        {
          "label": "2"
        },
        {
          "label": "0"
        }
      ]
    },
    {
      "text": "Câu 6. Hàm số y = −x³ + 3x² đồng biến trên khoảng nào?",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "(−∞; 0)"
        },
        {
          "label": "(2; +∞)"
        },
        {
          "label": "(−∞; 2)"
        },
        {
          "label": "(0; 2)",
          "correct": true
        }
      ]
    },
    {
      "text": "Câu 7. Số giao điểm của đồ thị hàm số y = x³ − 3x với trục hoành là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "2"
        },
        {
          "label": "1"
        },
        {
          "label": "3",
          "correct": true
        },
        {
          "label": "0"
        }
      ]
    },
    {
      "text": "Câu 8. Giá trị của log₂8 + log₃9 bằng",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "6"
        },
        {
          "label": "5",
          "correct": true
        },
        {
          "label": "17"
        },
        {
          "label": "1"
        }
      ]
    },
    {
      "text": "Câu 9. Nghiệm của phương trình 2^(x − 1) = 16 là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "x = 4"
        },
        {
          "label": "x = 3"
        },
        {
          "label": "x = 17"
        },
        {
          "label": "x = 5",
          "correct": true
        }
      ]
    },
    {
      "text": "Câu 10. Tập nghiệm của bất phương trình log₃(x − 1) < 2 là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "(1; 10)",
          "correct": true
        },
        {
          "label": "(−∞; 10)"
        },
        {
          "label": "(1; 9)"
        },
        {
          "label": "(10; +∞)"
        }
      ]
    },
    {
      "text": "Câu 11. Đạo hàm của hàm số y = e^(2x) là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "y' = e^(2x)"
        },
        {
          "label": "y' = 2e^(2x)",
          "correct": true
        },
        {
          "label": "y' = 2x·e^(2x − 1)"
        },
        {
          "label": "y' = e^(2x)/2"
        }
      ]
    },
    {
      "text": "Câu 12. Đạo hàm của hàm số y = ln(x² + 1) là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "y' = 1/(x² + 1)"
        },
        {
          "label": "y' = 2x"
        },
        {
          "label": "y' = 2x/(x² + 1)",
          "correct": true
        },
        {
          "label": "y' = x/(x² + 1)"
        }
      ]
    },
    {
      "text": "Câu 13. Với a > 0, biểu thức a^(2/3) · a^(1/3) bằng",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "a²"
        },
        {
          "label": "a",
          "correct": true
        },
        {
          "label": "a^(2/9)"
        },
        {
          "label": "a^(1/2)"
        }
      ]
    },
    {
      "text": "Câu 14. Tập xác định của hàm số y = log(x − 2) là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "[2; +∞)"
        },
        {
          "label": "ℝ"
        },
        {
          "label": "(2; +∞)",
          "correct": true
        },
        {
          "label": "ℝ \\ {2}"
        }
      ]
    },
    {
      "text": "Câu 15. Họ nguyên hàm của hàm số f(x) = 2x là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "2x² + C"
        },
        {
          "label": "2 + C"
        },
        {
          "label": "x²/2 + C"
        },
        {
          "label": "x² + C",
          "correct": true
        }
      ]
    },
    {
      "text": "Câu 16. Tích phân ∫₀¹ (3x² + 1) dx bằng",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "2",
          "correct": true
        },
        {
          "label": "3"
        },
        {
          "label": "4"
        },
        {
          "label": "1"
        }
      ]
    },
    {
      "text": "Câu 17. Họ nguyên hàm của hàm số f(x) = cos x là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "sin x + C",
          "correct": true
        },
        {
          "label": "−sin x + C"
        },
        {
          "label": "cos x + C"
        },
        {
          "label": "−cos x + C"
        }
      ]
    },
    {
      "text": "Câu 18. Nếu ∫₁³ f(x) dx = 5 thì ∫₁³ 2f(x) dx bằng",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "7"
        },
        {
          "label": "5/2"
        },
        {
          "label": "10",
          "correct": true
        },
        {
          "label": "25"
        }
      ]
    },
    {
      "text": "Câu 19. Diện tích hình phẳng giới hạn bởi hai đường y = x² và y = x bằng",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "1/3"
        },
        {
          "label": "1/6",
          "correct": true
        },
        {
          "label": "1/2"
        },
        {
          "label": "5/6"
        }
      ]
    },
    {
      "text": "Câu 20. Tích phân ∫₀^π sin x dx bằng",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "0"
        },
        {
          "label": "1"
        },
        {
          "label": "−2"
        },
        {
          "label": "2",
          "correct": true
        }
      ]
    },
    {
      "text": "Câu 21. Trên khoảng (0; +∞), một nguyên hàm của hàm số f(x) = 1/x là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "−1/x²"
        },
        {
          "label": "1/x²"
        },
        {
          "label": "ln x",
          "correct": true
        },
        {
          "label": "eˣ"
        }
      ]
    },
    {
      "text": "Câu 22. Thể tích khối lập phương có cạnh bằng 3 là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "27",
          "correct": true
        },
        {
          "label": "9"
        },
        {
          "label": "18"
        },
        {
          "label": "81"
        }
      ]
    },
    {
      "text": "Câu 23. Khối chóp có diện tích đáy bằng 6 và chiều cao bằng 4 có thể tích là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "24"
        },
        {
          "label": "12"
        },
        {
          "label": "10"
        },
        {
          "label": "8",
          "correct": true
        }
      ]
    },
    {
      "text": "Câu 24. Thể tích khối cầu có bán kính bằng 3 là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "12π"
        },
        {
          "label": "36π",
          "correct": true
        },
        {
          "label": "27π"
        },
        {
          "label": "108π"
        }
      ]
    },
    {
      "text": "Câu 25. Thể tích khối trụ có bán kính đáy bằng 2 và chiều cao bằng 5 là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "20π",
          "correct": true
        },
        {
          "label": "10π"
        },
        {
          "label": "40π"
        },
        {
          "label": "20π/3"
        }
      ]
    },
    {
      "text": "Câu 26. Thể tích khối nón có bán kính đáy bằng 3 và chiều cao bằng 4 là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "36π"
        },
        {
          "label": "15π"
        },
        {
          "label": "9π"
        },
        {
          "label": "12π",
          "correct": true
        }
      ]
    },
    {
      "text": "Câu 27. Diện tích mặt cầu có bán kính bằng 2 là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "8π"
        },
        {
          "label": "16π",
          "correct": true
        },
        {
          "label": "32π/3"
        },
        {
          "label": "4π"
        }
      ]
    },
    {
      "text": "Câu 28. Khối hộp chữ nhật có ba kích thước 2, 3, 4 có thể tích là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "9"
        },
        {
          "label": "26"
        },
        {
          "label": "24",
          "correct": true
        },
        {
          "label": "12"
        }
      ]
    },
    {
      "text": "Câu 29. Trong không gian Oxyz, cho A(1; 2; 3) và B(3; 4; 5). Trung điểm của đoạn AB có tọa độ là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "(4; 6; 8)"
        },
        {
          "label": "(1; 1; 1)"
        },
        {
          "label": "(2; 2; 2)"
        },
        {
          "label": "(2; 3; 4)",
          "correct": true
        }
      ]
    },
    {
      "text": "Câu 30. Trong không gian Oxyz, khoảng cách từ gốc tọa độ O đến điểm M(2; −1; 2) bằng",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "9"
        },
        {
          "label": "√5"
        },
        {
          "label": "3",
          "correct": true
        },
        {
          "label": "5"
        }
      ]
    },
    {
      "text": "Câu 31. Mặt cầu (x − 1)² + (y + 2)² + z² = 9 có tâm I và bán kính R là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "I(1; −2; 0), R = 3",
          "correct": true
        },
        {
          "label": "I(−1; 2; 0), R = 3"
        },
        {
          "label": "I(1; −2; 0), R = 9"
        },
        {
          "label": "I(−1; 2; 0), R = 9"
        }
      ]
    },
    {
      "text": "Câu 32. Mặt phẳng (P): 2x − y + 2z − 3 = 0 có một vectơ pháp tuyến là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "(2; 1; 2)"
        },
        {
          "label": "(2; −1; 2)",
          "correct": true
        },
        {
          "label": "(−1; 2; −3)"
        },
        {
          "label": "(2; −1; −3)"
        }
      ]
    },
    {
      "text": "Câu 33. Khoảng cách từ gốc tọa độ O đến mặt phẳng (P): 2x − y + 2z − 3 = 0 bằng",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "3"
        },
        {
          "label": "1",
          "correct": true
        },
        {
          "label": "1/3"
        },
        {
          "label": "9"
        }
      ]
    },
    {
      "text": "Câu 34. Cho u = (1; 2; 3) và v = (2; 0; −1). Tích vô hướng u · v bằng",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "−1",
          "correct": true
        },
        {
          "label": "1"
        },
        {
          "label": "5"
        },
        {
          "label": "−5"
        }
      ]
    },
    {
      "text": "Câu 35. Có bao nhiêu cách chọn 2 học sinh từ một nhóm 10 học sinh?",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "90"
        },
        {
          "label": "20"
        },
        {
          "label": "100"
        },
        {
          "label": "45",
          "correct": true
        }
      ]
    },
    {
      "text": "Câu 36. Có bao nhiêu cách xếp 4 bạn vào 4 chiếc ghế kê thành một hàng ngang?",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "16"
        },
        {
          "label": "12"
        },
        {
          "label": "24",
          "correct": true
        },
        {
          "label": "4"
        }
      ]
    },
    {
      "text": "Câu 37. Gieo một con xúc xắc cân đối và đồng chất một lần. Xác suất xuất hiện mặt có số chấm chẵn là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "1/3"
        },
        {
          "label": "1/6"
        },
        {
          "label": "1/2",
          "correct": true
        },
        {
          "label": "2/3"
        }
      ]
    },
    {
      "text": "Câu 38. Một hộp có 4 viên bi đỏ và 6 viên bi xanh. Lấy ngẫu nhiên 2 viên. Xác suất để cả 2 viên đều màu đỏ là",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "4/25"
        },
        {
          "label": "2/15",
          "correct": true
        },
        {
          "label": "1/5"
        },
        {
          "label": "2/5"
        }
      ]
    },
    {
      "text": "Câu 39. Cấp số cộng (uₙ) có u₁ = 2 và công sai d = 3. Số hạng u₁₀ bằng",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "32"
        },
        {
          "label": "30"
        },
        {
          "label": "27"
        },
        {
          "label": "29",
          "correct": true
        }
      ]
    },
    {
      "text": "Câu 40. Cấp số nhân (uₙ) có u₁ = 3 và công bội q = 2. Tổng 5 số hạng đầu tiên bằng",
      "votingType": "single",
      "points": 0.25,
      "options": [
        {
          "label": "93",
          "correct": true
        },
        {
          "label": "96"
        },
        {
          "label": "48"
        },
        {
          "label": "45"
        }
      ]
    }
  ]
} as const;

export const SHOWCASE_SURVEY = {
  "type": "deck",
  "deckMode": "survey",
  "title": "Chỉ số hạnh phúc WHO-5: 2 tuần qua bạn thế nào?",
  "caption": "WHO-5 là bộ 5 câu hỏi về sức khoẻ tinh thần do Tổ chức Y tế Thế giới (WHO) công bố, được dùng trong hàng trăm nghiên cứu trên khắp thế giới. Ẩn danh, chưa tới 1 phút. Đây là khảo sát cộng đồng, không phải chẩn đoán y khoa.",
  "tags": [
    "khaosat",
    "suckhoe",
    "who5"
  ],
  "media": {
    "url": "https://images.unsplash.com/photo-1626585957649-b82e43c1269d?w=1080&q=80&auto=format&fit=crop",
    "type": "image"
  },
  "allowGuestPresent": true,
  "questions": [
    {
      "text": "Trong 2 tuần qua, tôi cảm thấy vui vẻ và có tinh thần tốt.",
      "votingType": "single",
      "options": [
        {
          "label": "Mọi lúc"
        },
        {
          "label": "Hầu hết thời gian"
        },
        {
          "label": "Hơn nửa thời gian"
        },
        {
          "label": "Ít hơn nửa thời gian"
        },
        {
          "label": "Thỉnh thoảng"
        },
        {
          "label": "Không bao giờ"
        }
      ]
    },
    {
      "text": "Trong 2 tuần qua, tôi cảm thấy bình tĩnh và thư thái.",
      "votingType": "single",
      "options": [
        {
          "label": "Mọi lúc"
        },
        {
          "label": "Hầu hết thời gian"
        },
        {
          "label": "Hơn nửa thời gian"
        },
        {
          "label": "Ít hơn nửa thời gian"
        },
        {
          "label": "Thỉnh thoảng"
        },
        {
          "label": "Không bao giờ"
        }
      ]
    },
    {
      "text": "Trong 2 tuần qua, tôi cảm thấy năng động và tràn đầy sức sống.",
      "votingType": "single",
      "options": [
        {
          "label": "Mọi lúc"
        },
        {
          "label": "Hầu hết thời gian"
        },
        {
          "label": "Hơn nửa thời gian"
        },
        {
          "label": "Ít hơn nửa thời gian"
        },
        {
          "label": "Thỉnh thoảng"
        },
        {
          "label": "Không bao giờ"
        }
      ]
    },
    {
      "text": "Trong 2 tuần qua, tôi thức dậy với cảm giác tươi tỉnh, được nghỉ ngơi đầy đủ.",
      "votingType": "single",
      "options": [
        {
          "label": "Mọi lúc"
        },
        {
          "label": "Hầu hết thời gian"
        },
        {
          "label": "Hơn nửa thời gian"
        },
        {
          "label": "Ít hơn nửa thời gian"
        },
        {
          "label": "Thỉnh thoảng"
        },
        {
          "label": "Không bao giờ"
        }
      ]
    },
    {
      "text": "Trong 2 tuần qua, cuộc sống hằng ngày của tôi có nhiều điều khiến tôi thấy hứng thú.",
      "votingType": "single",
      "options": [
        {
          "label": "Mọi lúc"
        },
        {
          "label": "Hầu hết thời gian"
        },
        {
          "label": "Hơn nửa thời gian"
        },
        {
          "label": "Ít hơn nửa thời gian"
        },
        {
          "label": "Thỉnh thoảng"
        },
        {
          "label": "Không bao giờ"
        }
      ]
    }
  ]
} as const;
