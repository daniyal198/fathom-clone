// Every template yields the same shape ({ tldr, sections[] }) so one renderer handles all of them.
// Only the section guidance differs.
export type TemplateKey = "general" | "sales" | "project" | "standup" | "oneonone" | "interview" | "customer";

export const TEMPLATES: { key: TemplateKey; name: string; blurb: string; guidance: string }[] = [
  {
    key: "general",
    name: "General",
    blurb: "Takeaways, topics and next steps",
    guidance:
      'Sections: "Key takeaways" (3-6 bullets), then one section per major topic discussed (heading = the topic, 2-5 bullets each, in the order discussed), then "Next steps".',
  },
  {
    key: "sales",
    name: "Sales discovery",
    blurb: "Pain, budget, authority, timeline",
    guidance:
      'Sections: "Prospect & context", "Pain points", "Current solution", "Budget", "Decision process & stakeholders", "Timeline", "Objections & concerns", "Next steps". Omit a section only if it truly never came up; otherwise say what is unknown.',
  },
  {
    key: "project",
    name: "Project sync",
    blurb: "Status, decisions, blockers",
    guidance: 'Sections: "Status", "Decisions made", "Blockers & risks", "Open questions", "Next steps".',
  },
  {
    key: "standup",
    name: "Team standup",
    blurb: "Updates grouped by person",
    guidance:
      'One section per person who gave an update (heading = their name) with what they did, what is next and any blocker. Finish with a "Blockers needing help" section.',
  },
  {
    key: "oneonone",
    name: "1:1",
    blurb: "Wins, challenges, feedback",
    guidance: 'Sections: "Wins", "Challenges", "Feedback given or received", "Growth & career", "Follow-ups".',
  },
  {
    key: "interview",
    name: "Interview",
    blurb: "Background, strengths, concerns",
    guidance:
      'Treat the main guest as the candidate/interviewee. Sections: "Background", "Strengths", "Concerns", "Notable answers" (quote briefly), "Recommendation & open questions".',
  },
  {
    key: "customer",
    name: "Customer check-in",
    blurb: "Health, adoption, risks",
    guidance:
      'Sections: "Account health", "Adoption & usage", "Issues raised", "Expansion signals", "Churn risks", "Next steps".',
  },
];

export const templateByKey = (k: string) => TEMPLATES.find((t) => t.key === k) ?? TEMPLATES[0];
