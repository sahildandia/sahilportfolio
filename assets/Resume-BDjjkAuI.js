import { j as e } from "./index-D5RHyzUd.js";

const ResumeSection = () => {
  return e.jsxs("section", {
    id: "resume",
    className: "py-20 relative",
    children: [
      e.jsx("div", {
        className: "absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-slate-950 to-transparent pointer-events-none",
      }),
      e.jsxs("div", {
        className: "container mx-auto px-6 max-w-4xl relative z-10",
        children: [
          e.jsxs("div", {
            className: "text-center mb-12",
            children: [
              e.jsxs("h2", {
                className: "text-3xl md:text-4xl font-bold text-white mb-4",
                children: ["My ", e.jsx("span", { className: "text-primary", children: "Journey" })],
              }),
              e.jsx("p", {
                className: "text-gray-400",
                children: "Education milestones that shape my foundation in computer science.",
              }),
            ],
          }),
          e.jsxs("div", {
            className: "grid md:grid-cols-2 gap-12 md:gap-20 mb-12",
            children: [
              e.jsxs("div", {
                className: "relative p-6 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-xl overflow-hidden group",
                children: [
                  e.jsx("div", { className: "absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none" }),
                  e.jsx("div", { className: "absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" }),
                  e.jsxs("div", {
                    className: "relative z-10",
                    children: [
                      e.jsxs("div", {
                        className: "flex items-center mb-4",
                        children: [
                          e.jsx("div", {
                            className: "w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mr-3 text-primary",
                            children: "B",
                          }),
                          e.jsx("h3", { className: "text-xl font-bold text-white", children: "Bachelor of Engineering" }),
                        ],
                      }),
                      e.jsxs("div", {
                        className: "mb-4",
                        children: [
                          e.jsx("h4", { className: "text-white font-medium", children: "Computer Science" }),
                          e.jsx("span", { className: "text-primary text-sm font-semibold mb-2 block", children: "2024 – 2028" }),
                        ],
                      }),
                      e.jsx("p", {
                        className: "text-gray-400 text-sm",
                        children: "M Kumarasamy College of Engineering, Karur, Tamil Nadu | CGPA: 7.7 / 10.0 (Semesters 1–2)",
                      }),
                      e.jsx("p", {
                        className: "text-gray-400 text-sm mt-4",
                        children: "Relevant Coursework: Software Development, Data Structures, Database Management, Computer Architecture, Networking, Cyber Security, Web Development",
                      }),
                    ],
                  }),
                ],
              }),
              e.jsxs("div", {
                className: "relative p-6 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-xl overflow-hidden group",
                children: [
                  e.jsx("div", { className: "absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none" }),
                  e.jsx("div", { className: "absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-secondary/50 to-transparent" }),
                  e.jsxs("div", {
                    className: "relative z-10",
                    children: [
                      e.jsxs("div", {
                        className: "flex items-center mb-4",
                        children: [
                          e.jsx("div", {
                            className: "w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mr-3 text-primary",
                            children: "XII",
                          }),
                          e.jsx("h3", { className: "text-xl font-bold text-white", children: "Higher Secondary" }),
                        ],
                      }),
                      e.jsxs("div", {
                        className: "mb-4",
                        children: [
                          e.jsx("h4", { className: "text-white font-medium", children: "Science Stream" }),
                          e.jsx("span", { className: "text-primary text-sm font-semibold mb-2 block", children: "2023 – 2024" }),
                        ],
                      }),
                      e.jsx("p", {
                        className: "text-gray-400 text-sm",
                        children: "Mishra Shiksha Niketan Higher Secondary School, Arnia, Jammu | Percentage: 75%",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          e.jsxs("div", {
            className: "flex flex-col sm:flex-row justify-center items-center gap-4",
            children: [
              e.jsx("a", {
                href: "/assets/sahil_resume.docx",
                target: "_blank",
                rel: "noopener noreferrer",
                className: "group flex items-center gap-3 px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 text-white",
                children: "Open Resume",
              }),
              e.jsx("a", {
                href: "/assets/sahil_resume.docx",
                download: "Sahil_Resume.docx",
                className: "px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium transition-colors",
                children: "Download Resume",
              }),
            ],
          }),
        ],
      }),
      e.jsx("div", {
        className: "absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-slate-950 pointer-events-none",
      }),
    ],
  });
};

export default ResumeSection;
