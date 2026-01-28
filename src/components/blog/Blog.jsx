import imgReact from "../../assets/images/blog/blog-react.png";
import imgWordpress from "../../assets/images/blog/blog-wordpress.png";
import imgShopify from "../../assets/images/blog/blog-shopify.png";
import imgFrontend from "../../assets/images/blog/blog-frontend.png";
import imgEcommerce from "../../assets/images/blog/blog-ecommerce.png";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import MonoBlog from "./MonoBlog";
import "swiper/css";
import "swiper/css/pagination";
import "./blog.css";

// Breakpoints for swiperJS
const custom_breakpoints = {
  640: {
    slidesPerView: 2,
    spaceBetween: 15,
  },
  768: {
    slidesPerView: 3,
    spaceBetween: 15,
  },
  1220: {
    slidesPerView: 3,
    spaceBetween: 40,
  },
};

const blogData = [
  {
    id: 1,
    image: imgReact,
    date: "12 Jan, 2026",
    comments: 24,
    title: "Mastering React and Next.js for Scalable Web Applications",
    link: "#!",
  },
  {
    id: 2,
    image: imgWordpress,
    date: "05 Jan, 2026",
    comments: 12,
    title: "Custom WordPress Plugin Development: Best Practices",
    link: "#!",
  },
  {
    id: 3,
    image: imgShopify,
    date: "28 Dec, 2025",
    comments: 8,
    title: "Optimizing Shopify Stores for Maximum Performance",
    link: "#!",
  },
  {
    id: 4,
    image: imgFrontend,
    date: "15 Dec, 2025",
    comments: 18,
    title: "The Future of Frontend Development: Trends for 2025",
    link: "#!",
  },
  {
    id: 5,
    image: imgEcommerce,
    date: "02 Dec, 2025",
    comments: 5,
    title: "High-Conversion E-commerce Experiences with Woo",
    link: "#!",
  },
  {
    id: 6,
    image: imgReact,
    date: "20 Nov, 2025",
    comments: 9,
    title: "Advanced Animation Techniques for Modern Web Interfaces",
    link: "#!",
  },
];

const Blog = () => {
  return (
    <div className="content py-[100px] px-2 relative" id="blog">
      <div className="max-w-135 text-center mx-auto pb-17.5">
        <p className="section-title pb-6">Blog</p>
        <p className="text-xs xs:text-[16px] md:text-lg text-gray-400 pb-10">
          Check out my recent blog posts where I share insights on design,
          development, and the latest industry trends.
        </p>
      </div>
      <Swiper
        grabCursor={true}
        breakpoints={custom_breakpoints}
        pagination={{ clickable: true }}
        modules={[Pagination]}
      >
        {blogData?.map((data, index) => (
          <SwiperSlide
            key={index}
            className="mb-10" /* pagination margin bottom to 40px */
            style={{ backgroundColor: "rgba(0,0,0,0)" }}
          >
            <MonoBlog data={data} key={index} />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default Blog;
