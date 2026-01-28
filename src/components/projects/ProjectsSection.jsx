import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProjectCard from "./ProjectCard";
import card1 from "../../assets/images/portfolio-images/card-1.png";
import card2 from "../../assets/images/portfolio-images/card-2.jpg";
import card3 from "../../assets/images/portfolio-images/card-3.png";
import card4 from "../../assets/images/portfolio-images/card-4.png";
import card5 from "../../assets/images/portfolio-images/card-5.webp";

const projectData = [
  {
    id: 1,
    image: card1,
    category: "Employee Management",
    title: "Taskify",
    description:
      "Designed and developed a comprehensive employee task management system to manage tasks, workflows, and improve team productivity.",
    link: "#!",
  },
  {
    id: 2,
    image: card2,
    category: "WordPress Plugin",
    title: "KOMAKI Electric Vehicles",
    description:
      "Developed a custom WordPress plugin for campaign lead capture along with a centralized admin dashboard to manage and track leads efficiently.",
    link: "https://komaki.in/",
  },
  {
    id: 3,
    image: card3,
    category: "WooCommerce",
    title: "SGR777 Foods",
    description:
      "Implemented a phone number validation discount system and a complete referral plugin with tracking and analytics for WooCommerce.",
    link: "https://www.sgr777foods.com/",
  },
  {
    id: 4,
    image: card4,
    category: "SaaS UI",
    title: "TAABI AI",
    description:
      "Developed modern, responsive user interfaces with smooth animations for an AI-based SaaS platform.",
    link: "https://taabi.ai/",
  },
  {
    id: 5,
    image: card5,
    category: "Construction",
    title: "JR Builders",
    description:
      "Designed and developed a modern, fully responsive website for a construction company, showcasing services, completed projects, and brand identity.",
    link: "#",
  },
  {
    id: 6,
    image: card1,
    category: "Web Development",
    title: "Portfolio Project v1",
    description:
      "A previous iteration of my personal portfolio, focusing on minimalism and smooth scroll experiences.",
    link: "#",
  },
  {
    id: 7,
    image: card2,
    category: "E-commerce",
    title: "Luxe Fashion Store",
    description:
      "An elegant e-commerce platform built with React and Shopify, featuring high-speed product filtering and a custom checkout flow.",
    link: "#",
  },
];

const ProjectsSection = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const PROJECTS_LIMIT = 6;

  const initialProjects = projectData.slice(0, PROJECTS_LIMIT);
  const extraProjects = projectData.slice(PROJECTS_LIMIT);

  return (
    <div
      className="content mt-10 md:mt-15 xl:mt-25 mb-10 md:mb-25 max-xxl:p-2"
      id="projects"
    >
      <div className="xl:mb-17.5 mb-5">
        <div className="max-sm:px-2 text-center mx-auto max-w-144.25">
          <p className="section-title ">Projects</p>
          <p className="font-normal text-[18px] max-sm:text-[14px] pt-6 text-gray-400">
            Here's a selection of my recent work, showcasing my skills in
            creating user-centric and visually appealing interfaces.
          </p>
        </div>
      </div>
      <div className="mx-auto flex flex-col items-center">
        <div className="grid xl:grid-cols-3 md:grid-cols-2 gap-6 w-full">
          {initialProjects.map((data, index) => (
            <ProjectCard data={data} key={index} />
          ))}
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="overflow-hidden w-full"
            >
              <div className="grid xl:grid-cols-3 md:grid-cols-2 gap-6 mt-6">
                {extraProjects.map((data, index) => (
                  <ProjectCard data={data} key={index + PROJECTS_LIMIT} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {projectData.length > PROJECTS_LIMIT && (
          <div className="text-center mt-12">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-8 py-3.5 bg-picto-primary text-white font-semibold rounded-full hover:bg-opacity-90 transition-all duration-300 shadow-lg shadow-purple-500/20"
            >
              {isExpanded ? "Show Less" : "Explore More Projects"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectsSection;
