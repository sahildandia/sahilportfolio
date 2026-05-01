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

const iconMap = {
  W: "🌐",
  T: "💡",
  A: "⚡",
  P: "🎯",
};

const ServicesSection = () => {
  return e.jsxs("section", {
    id: "services",
    className: "py-32 relative overflow-hidden",
    children: [
      e.jsx("div", {
        className: "absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none",
      }),
      e.jsx("div", {
        className: "absolute top-20 right-0 w-80 h-80 bg-primary/10 rounded-full blur-[120px] opacity-20 pointer-events-none animate-pulse",
      }),
      e.jsx("div", {
        className: "absolute bottom-20 left-0 w-72 h-72 bg-secondary/10 rounded-full blur-[100px] opacity-15 pointer-events-none",
      }),
      e.jsxs("div", {
        className: "container mx-auto px-6 relative z-10",
        children: [
          e.jsxs("div", {
            className: "text-center mb-20",
            children: [
              e.jsxs("h2", {
                className: "text-4xl md:text-5xl font-bold text-white mb-6 leading-tight",
                children: ["How I Can ", e.jsx("span", { className: "bg-gradient-to-r from-primary via-orange-400 to-primary bg-clip-text text-transparent", children: "Help You" })],
              }),
            ],
          }),
          e.jsx("div", {
            className: "grid md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8",
            children: services.map((service, idx) =>
              e.jsx(
                "a",
                {
                  href: service.href ?? "#contact",
                  className: "group relative h-full",
                  children: e.jsxs("div", {
                    className: "relative h-full p-8 rounded-2xl overflow-hidden transition-all duration-500 cursor-pointer flex flex-col",
                    style: {
                      background: "linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(15, 23, 42, 0.4) 100%)",
                      border: "1px solid rgba(244, 81, 30, 0.1)",
                      backdropFilter: "blur(10px)",
                    },
                    children: [
                      e.jsx("div", {
                        className: "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
                        style: {
                          background: "linear-gradient(135deg, rgba(244, 81, 30, 0.05) 0%, rgba(244, 81, 30, 0.02) 100%)",
                        },
                      }),
                      e.jsx("div", {
                        className: "absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                      }),
                      e.jsxs("div", {
                        className: "relative z-10",
                        children: [
                          e.jsx("div", {
                            className: "w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center text-3xl mb-6 group-hover:scale-125 group-hover:shadow-lg group-hover:shadow-primary/50 transition-all duration-300",
                            children: iconMap[service.title.slice(0, 1)] || "✨",
                          }),
                          e.jsx("div", {
                            className: "flex items-start gap-2 mb-4",
                            children: e.jsxs("h3", {
                              className: "text-2xl font-bold text-white group-hover:text-primary transition-colors duration-300",
                              children: [service.title.slice(0, 1), e.jsx("span", { className: "ml-1", children: service.title.slice(1) })],
                            }),
                          }),
                          e.jsx("p", {
                            className: "text-gray-400 text-sm mb-8 leading-relaxed flex-grow group-hover:text-gray-300 transition-colors duration-300",
                            children: service.description,
                          }),
                          e.jsxs("div", {
                            className: "flex items-center justify-between pt-6 border-t border-white/5 mt-auto group-hover:border-primary/20 transition-colors duration-300",
                            children: [
                              e.jsx("span", {
                                className: "text-xs font-bold text-primary uppercase tracking-widest group-hover:text-orange-400 transition-colors duration-300",
                                children: service.price,
                              }),
                              e.jsx("div", {
                                className: "w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/30 transition-all duration-300 group-hover:translate-x-1",
                                children: e.jsx("span", {
                                  className: "text-primary text-sm",
                                  children: "→",
                                }),
                              }),
                            ],
                          }),
                        ],
                      }),
                      e.jsx("div", {
                        className: "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
                        style: {
                          boxShadow: "inset 0 0 30px rgba(244, 81, 30, 0.1)",
                        },
                      }),
                    ],
                  }),
                },
                service.title,
              ),
            ),
          }),
          e.jsx("div", {
            className: "mt-16 text-center",
            children: e.jsx("p", {
              className: "text-gray-500 text-sm",
              children: "Each service is customized to match your unique goals and timeline.",
            }),
          }),
        ],
      }),
    ],
  });
};

export default ServicesSection;
