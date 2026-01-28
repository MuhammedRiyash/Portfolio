import {
  faFacebookF,
  faGithub,
  faInstagram,
  faLinkedin,
  faWhatsapp,
} from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const socialIcons = [
  { icon: faLinkedin, link: "https://www.linkedin.com/in/muhammed-riyash-5a0774393/" },
  { icon: faGithub, link: "https://github.com/MuhammedRiyash" },
  { icon: faInstagram, link: "https://www.instagram.com/riyash.x.x/" },
  { icon: faFacebookF, link: "https://www.facebook.com/share/1Kmji1tKof/" },
  { icon: faWhatsapp, link: "https://wa.me/917094836267" },
];

const SocialMedia = () => {
  return socialIcons.map((item, index) => (
    <a
      href={item.link}
      className={`text-picto-primary hover:bg-picto-primary p-2 pt-3 xs:p-2.5 xs:pt-3.75 sm:pt-4 md:pt-5 sm:p-3 md:p-3.75 hover:text-white rounded-md`}
      key={index}
    >
      <FontAwesomeIcon
        icon={item.icon}
        className={`text-xl w-4.5 aspect-square`}
      />
    </a>
  ));
};

export default SocialMedia;
