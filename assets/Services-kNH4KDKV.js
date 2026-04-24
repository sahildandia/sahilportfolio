import { j as e } from "./index-D5RHyzUd.js";

const services = [
  {
    title: "Website Development",
    description: "Custom, high-performance websites built with modern technologies like React and Tailwind CSS.",
    price: "Starting at $500",
  },
  {
    title: "Tech Consultation",
    description: "Expert advice on tech stack selection, architecture, and best practices for your startup.",
    price: "Hourly / Project",
  },
  {
    title: "AI Automation",
    description: "Leveraging AI for next-gen workflows: Text-to-Image generation, AI video editing, and content scaling.",
    price: "Custom Solutions",
  },
  {
    title: "Projects",
    description: "Featured work including RiverGuard, a browser-based river pollution source tracker built for hackathons and SDG impact.",
    price: "View Project",
    href: "/projects.html",
  },
];

const projects = [
  {
    name: "RiverGuard",
    category: "Hackathon Project",
    description: "A browser-based river pollution source tracker designed to map issues, support awareness, and route action to the right people.",
  },
  {
    name: "Creative Portfolio Work",
    category: "Web Experience",
    description: "Bold portfolio and landing page builds focused on conversion, motion, and a premium visual style.",
  },
  {
    name: "MKCE Clubs",
    category: "Web Development Project",
    description: "A live website project for clubs and student activities at MKCE.",
    href: "https://clubs.mkce.ac.in/",
    image: "/project images/webdevlopment.png",
  },
];

const ServicesSection = () => {
  return e.jsxs("section", {
    id: "services",
    className: "py-20 relative overflow-hidden",
    children: [
      e.jsx("div", {
        className: "absolute top-1/2 left-0 w-40 md:w-64 h-40 md:h-64 bg-primary/5 rounded-full blur-[50px] md:blur-[100px] -translate-y-1/2",
      }),
      e.jsxs("div", {
        className: "container mx-auto px-6 relative z-10",
        children: [
          e.jsxs("div", {
            className: "text-center mb-16",
            children: [
              e.jsxs("h2", {
                className: "text-3xl md:text-4xl font-bold text-white mb-4",
                children: ["How I Can ", e.jsx("span", { className: "text-primary", children: "Help You" })],
              }),
              e.jsx("p", {
                className: "text-gray-400 max-w-xl mx-auto",
                children: "Professional services tailored to your specific needs.",
              }),
            ],
          }),
          e.jsx("div", {
            className: "grid md:grid-cols-2 lg:grid-cols-4 gap-6",
            children: services.map((service) =>
              e.jsx(
                "a",
                {
                  href: service.href ?? "#contact",
                  className: "rotating-border-card hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(244,81,30,0.2)] transition-all duration-300 cursor-pointer block",
                  children: e.jsxs("div", {
                    className: "p-8 h-full flex flex-col group relative z-10",
                    children: [
                      e.jsx("div", {
                        className: "w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform duration-300",
                        children: service.title.slice(0, 1),
                      }),
                      e.jsx("h3", { className: "text-xl font-bold text-white mb-3", children: service.title }),
                      e.jsx("p", { className: "text-gray-400 text-sm mb-6 leading-relaxed flex-grow", children: service.description }),
                      e.jsx("div", {
                        className: "pt-6 border-t border-white/5 mt-auto",
                        children: e.jsx("span", {
                          className: "text-xs font-semibold text-primary uppercase tracking-wide",
                          children: service.price,
                        }),
                      }),
                    ],
                  }),
                },
                service.title,
              ),
            ),
          }),
        ],
      }),
      e.jsx("div", {
        className: "absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-slate-950 pointer-events-none",
      }),
    ],
  });
};

export default ServicesSection;
