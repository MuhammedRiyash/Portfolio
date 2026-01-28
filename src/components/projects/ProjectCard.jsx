import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const ProjectCard = ({ data }) => {
  return (
    <div className="max-w-106 overflow-hidden rounded-2xl outline-[#FFFFFF] hover:shadow-2xl duration-300 transition-all shadow-gray-300 border border-gray-200 h-full flex flex-col justify-between">
      <div>
        <div className="overflow-hidden">
          <img
            src={data?.image}
            alt={`${data?.title} image`}
            className="w-full aspect-video object-cover"
          />
        </div>
        <div className="p-4 xs:p-8">
          <p className="text-gray-400 text-xs font-medium">{data?.category}</p>
          <p className="text-gray-900 text-md xxs:text-lg font-semibold pt-1 mb-3">
            {data?.title}
          </p>
          <p
            style={{ lineHeight: "20px", letterSpacing: "0%" }}
            className="text-gray-600 text-xs xxs:text-[14px] text-wrap"
          >
            {data?.description}
          </p>
        </div>
      </div>
      <div className="px-4 xs:px-8 pb-8">
        <a
          href={data?.link}
          className="btn hover:border-picto-primary hover:text-picto-primary bg-white text-sm xs:text-[16px] font-semibold hover:gap-3 xs:hover:gap-4 transition-all duration-300 py-3 xs:py-4 px-6 max-sm:w-full border border-gray-200 flex justify-center items-center"
        >
          Case Study
          <span className="ms-1 xs:ms-3">
            <FontAwesomeIcon icon={faArrowRight} size="l" className="" />
          </span>
        </a>
      </div>
    </div>
  );
};

export default ProjectCard;
