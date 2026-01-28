import SocialMedia from "../socialMedia/SocialMedia";
import logo from "../../../assets/images/logo-header-footer.png";

/* Footer nabLinks */
const navItems = [
  { id: 1, name: "Home", url: "Home" },
  { id: 2, name: "About", url: "About" },
  { id: 3, name: "Process", url: "Process" },
  { id: 4, name: "Projects", url: "projects" },
  { id: 5, name: "Blog", url: "Blog" },
  { id: 6, name: "Services", url: "Services" },
  { id: 7, name: "Contact", url: "Contact" },
];
const copyrightYear = new Date().getFullYear();

const Footer = () => {
  return (
    <div className="bg-slate-900 pt-20 pb-10">
      <div className="content max-2xl:px-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-12 border-b border-slate-700">
          {/* Brand Section */}
          <div className="flex flex-col items-center md:items-start">
            <a href="#" className="flex items-center border-0 mb-4">
              <img src={logo} alt="Muhammed Riyash Logo" className="h-16 object-contain filter brightness-0 invert" />
            </a>
            <p className="text-slate-400 text-sm text-center md:text-left max-w-xs">
              Front-End & WordPress/Shopify Developer with 3+ years of experience creating high-performing websites.
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col items-center md:items-start">
            <h3 className="text-white font-semibold text-lg mb-4">Quick Links</h3>
            <div className="flex flex-col space-y-2">
              {navItems.map((item) => (
                <a
                  key={item.id}
                  className="text-slate-400 hover:text-picto-primary transition-colors duration-300 text-sm"
                  href={`#${item.url.toLowerCase()}`}
                >
                  {item.name}
                </a>
              ))}
            </div>
          </div>

          {/* Contact & Social */}
          <div className="flex flex-col items-center md:items-start">
            <h3 className="text-white font-semibold text-lg mb-4">Connect With Me</h3>
            <div className="mb-4">
              <SocialMedia />
            </div>
            <p className="text-slate-400 text-sm">
              thisismd.riyash@gmail.com
            </p>
            <p className="text-slate-400 text-sm mt-2">
              +91 7094836267
            </p>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-8 text-center">
          <p className="text-slate-500 text-sm">
            Copyright © {copyrightYear} Muhammed Riyash. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Footer;
