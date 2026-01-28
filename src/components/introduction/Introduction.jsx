import person from "../../assets/images/profile_pic.jpg";
import "./introduction.css";
import InformationSummary from "./InformationSummary";

// Information summary data
const informationSummaryData = [
  {
    id: 1,
    title: "Experience",
    description: "3 Yrs",
  },
  {
    id: 2,
    title: "Projects Completed",
    description: "14+",
  },
  {
    id: 3,
    title: "Happy Clients",
    description: "27",
  },
];

const Introduction = () => {
  return (
    <div
      className="flex max-lg:flex-col-reverse items-center sm:justify-between pt-10 lg:min-h-screen max-xl:gap-2 p-2 max-xxl:px-4"
      id="introduction"
    >
      <div className="w-full flex flex-col justify-between max-lg:text-center">
        <div className="me-31.5 w-full lg:w-auto transition-all duration-500">
          <p className="text-3xl xxs:text-4xl sm:max-xl:text-5xl xl:text-6xl font-semibold w-full">
            Hello, <br />
            I’m Muhammed Riyash
          </p>
          <p className="text-xs xxs:text-lg lg:text-[18px] my-6">
            <span className="bg-highlight">Front-End & WordPress/Shopify Developer</span>{' '}
            with <span className="bg-highlight">3+ years</span> of experience.
            I create high-performing, conversion-focused websites that help businesses grow.
          </p>
          <p className="text-center lg:text-start">
            <a
              className="btn-primary btn btn-xs xxs:btn-lg text-white"
              href="#contact"
            >
              Say Hello!
            </a>
          </p>
        </div>
        <div className="mx-auto lg:mx-0 relative">
          <div className="grid max-xxs:grid-flow-col grid-cols-3 w-fit mt-10 gap-1">
            {informationSummaryData.map((item) => (
              <InformationSummary key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
      <div
        className={`max-w-[250px] lg:max-w-[400px] w-full h-full max-lg:mx-auto aspect-square relative`}
      >
        <img
          className={`shadow-2xl shadow-gray-200 w-full h-full absolute bottom-0 object-cover bg-white rounded-full border-4 border-white`}
          src={person}
          alt="person"
        />
      </div>
    </div>
  );
};

export default Introduction;
