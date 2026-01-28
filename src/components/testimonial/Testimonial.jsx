import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/effect-fade";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Autoplay, EffectFade, Navigation, Pagination } from "swiper/modules";
import TestimonialTemplate from "./TestimonialTemplate";
import "./testimonial.css";

import avatar from "../../assets/images/profile_pic.jpg";

const testimonialData = [
  {
    image: avatar,
    rating: 5,
    message: "Expert React Developer",
    quote: `Muhammed handled our React-based module migration smoothly. We saw a clear improvement in performance and code structure. His attention to technical details made a real difference.`,
    name: "Arjun Raghavan",
    designation: "CTO, NexaTech Solutions",
  },
  {
    image: avatar,
    rating: 5,
    message: "Reliable WordPress Solutions",
    quote: `Muhammed delivered a custom WordPress plugin that streamlined our internal workflow. Clean implementation, timely delivery, and excellent post-launch support.`,
    name: "Priya Natarajan",
    designation: "Marketing Manager, BrandLeaf",
  },
  {
    image: avatar,
    rating: 5,
    message: "Shopify Performance Specialist",
    quote: `After his Shopify optimization and UX improvements, we saw a noticeable increase in conversions and page speed. Very professional and easy to work with.`,
    name: "Karthik Subramanian",
    designation: "Founder, UrbanCart",
  },
  {
    image: avatar,
    rating: 5,
    message: "Strong Frontend Expertise",
    quote: `Clean UI implementation, responsive layouts, and performance-focused development. Muhammed consistently delivered high-quality frontend work aligned with our design goals.`,
    name: "Divya Krishnan",
    designation: "Product Lead, InnoWare Systems",
  },
];


const Testimonial = () => {
  return (
    <div className="flex mx-auto justify-center px-2 max-w-218 py-[100px] md:py-[150px]">
      <div className="w-full h-full cursor-grab">
        <p className="section-title mb-6 text-center">Testimonial</p>
        <Swiper
          id="testimonialSwiper"
          spaceBetween={30}
          navigation={false}
          loop={true}
          autoplay={{
            delay: 2000,
            disableOnInteraction: false,
          }}
          pagination={{
            clickable: true,
          }}
          modules={[Autoplay, EffectFade, Navigation, Pagination]}
        >
          {testimonialData.map((testimonial, index) => (
            <SwiperSlide key={index}>
              <TestimonialTemplate testimonial={testimonial} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
};

export default Testimonial;
