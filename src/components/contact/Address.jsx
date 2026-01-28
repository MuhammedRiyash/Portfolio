import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";

const Address = ({ item }) => {
  const [hover, setHover] = useState(false);

  return (
    <div
      className="w-full p-4 md:p-5 flex items-start rounded-[10px] bg-white hover:scale-[1.02] duration-300 cursor-pointer hover:shadow-[0px_0px_37px_5px_rgba(0,_0,_0,_0.1)] shadow-gray-200"
      /* Scale effect:  */
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className={`h-10 md:h-12 aspect-square flex-shrink-0 ${hover ? "bg-picto-primary" : "bg-[#EDD8FF80]"
          } center rounded-[4px]`}
      >
        <FontAwesomeIcon
          icon={item?.icon}
          className={`text-lg md:text-xl ${hover ? "text-white" : "text-picto-primary"
            }`}
        />
      </div>
      <div className="ms-5">
        <p className="text-[12px] md:text-[14px] text-[#424E60] font-normal">
          {item?.title}:
        </p>
        <p className="text-[14px] md:text-[16px] text-[#132238] font-medium">
          {item?.description}
        </p>
      </div>
    </div>
  );
};

export default Address;
