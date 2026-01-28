import { faStar } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const TestimonialTemplate = ({ testimonial }) => {
  return (
    <div className="flex flex-col h-full text-center items-center">
      <div className="max-w-xl">
        <div className="mb-6">
          <img
            className="w-20 h-20 rounded-full mx-auto object-cover border-4 border-white shadow-lg"
            src={testimonial?.image}
            alt={testimonial?.name}
          />
        </div>
        <div className="flex justify-center gap-1 mb-4">
          {[...Array(5)].map((_, i) => (
            <FontAwesomeIcon
              key={i}
              icon={faStar}
              className="text-yellow-400"
            />
          ))}
        </div>
        <p className="text-picto-primary font-bold text-sm uppercase tracking-widest mb-3">
          {testimonial?.message}
        </p>
        <p className="text-lg sm:text-xl font-medium leading-relaxed mb-6 text-slate-700">
          “{testimonial?.quote}”
        </p>
        <div className="mt-auto">
          <p className="text-slate-900 font-bold text-lg">
            {testimonial?.name}
          </p>
          <p className="text-slate-500 text-sm sm:text-base">
            {testimonial?.designation}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TestimonialTemplate;
