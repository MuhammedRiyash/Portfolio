import Roles from "./Roles";

const rolesData = [
  {
    id: 1,
    title: "Frontend Development",
    description:
      "HTML5, CSS3, JavaScript (ES6+), React.js, Bootstrap, Responsive Design. Building responsive user interfaces following mobile-first design principles.",
  },
  {
    id: 2,
    title: "WordPress Development",
    description:
      "Theme and plugin development, WooCommerce extensions analysis. Custom plugin development (lead management, order tracking, referral programs).",
  },
  {
    id: 3,
    title: "Shopify Development",
    description:
      "Shopify (Liquid, Metafields), store customization, performance optimization, and migration.",
  },
];

const Profession = () => {
  return (
    <div
      className="content grid md:grid-cols-2 max-xxl:px-4 xxl:px-2 py-10 md:py-15 lg:py-37.5"
      id="services"
    >
      <div className="flex flex-col justify-between h-fit md:pe-8 lg:pe-16 max-md:text-center my-auto">
        <p className="section-title max-md:text-center">My key areas of expertise</p>
        <div className="mt-6 text-[14px]">
          <p className="text-xs sm:text-lg font-normal text-gray-400 mb-4">
            UI/UX implementation, cross-browser testing, performance optimization, SEO best practices, client requirement analysis, and agile project execution.
          </p>
          <p className="text-xs sm:text-lg font-normal text-gray-400">
            I strive to build immersive and beautiful web applications through carefully crafted code and user-centric design.
          </p>
        </div>
        <a
          href="#!"
          className="mt-5 md:mt-12.5 btn btn-primary text-white w-fit md:py-3 md:px-6 text-[12px] sm:text-[16px] font-semibold max-md:mx-auto max-md:mb-5"
        >
          Say Hello!
        </a>
      </div>
      <div className="">
        {rolesData.map((role, index) => (
          <Roles role={role} key={index} />
        ))}
      </div>
    </div>
  );
};

export default Profession;
