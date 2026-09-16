i ahve to make a project under auriga it ai assist test where i can use any ai agent

this is mail that to use
1 of 9,313

Problem Code for Round-II: Auriga IT | B.Tech-(CS, IT, AI, DS, AI&DS, CY, GT, IOT, AI&ML, CT&FSD, EE&CE, ECE) & MCA Batch 2027

External

Inbox

image

Training & Placement Office
14:29 (1 minute ago)		
		
to Dipti, Arshad, (6131), Arvind, Sanjay, bcc: me	image

icon

DetectsvgsvgEnglish (USA)svgsvgTranslate email

Dear Students,

Welcome to the next level of Assessment of Auriga IT, the Round 2 — "Builder" Round.

You must ensure that you are sitting at the same spot where you sat in Round-1, today morning.

Round 2 is a hands-on "Builder" round that assesses how candidates approach an open-ended, real-world problem.
- Duration: The round is 2.5 hours long. Submissions will not be accepted after the 2.5-hour window closes.
- Problem statement: Each candidate will be given a short, real-world problem statement. No further explanation or specification will be provided beyond that statement.
- Deriving the solution: Candidates are expected to interpret the problem themselves and determine the features and specifications to be implemented. They are free to use any AI assistance or tools (for example, GitHub Copilot) to help infer the requirements and build their solution.
- Tech stack: Candidates may use any technology stack they are comfortable with.
- Environment: All coding is to be done online using GitHub Codespaces, accessed via the candidate's college email ID.

Problem Assignment: habit_tracker

Submission Guidelines
The final solution must be a public GitHub repository, and its root folder must contain the following three files, which are required for evaluation:
- README.md — instructions for project setup, running, and debugging.
- REASONING.md — an explanation of the thought process behind the solution.
- AI_LOGS.md — a complete copy of the candidate's conversation with the AI tool (Copilot or any other). This log must be pasted as-is and not modified in any way; any alteration will lead to a deduction of marks.

**Candidates must submit the public GitHub repository URL through the following form: **https://forms.gle/eEJNPdbrtr7Stu497

Please note that the 2.5-hour limit is strict — any submission received after the window closes will not be entertained.

**For any query you can contact: **

Mr. Arshad Nadeem (Head, T&P) - 8282823759

Mr. Kamal Kumar Sharma (Officer, T&P) - 9829332828

Mr. Arvind Kumar Mehra (Office Executive, T&P) - 8282823748

Best Wishes

**Dipti Lodha **

Director Corporate Relations ||Placements & Training || Alumni Relations||

Poornima & JIET Group || www.poornima.org || www.poornima.edu.in

M: +91-9828510629 

Email: diptilodha@poornima.org

make sure these to amke at end and with making project taking in know
readme.md the project detail were there
reasoning .md where all logic are there
ai.md where all chat of ai there

Yes. I understand the assessment structure, and the most important thing is that we build the Habit Tracker while keeping the required README.md, REASONING.md, and AI_LOGS.md in mind from the beginning, not as an afterthought.

I can help you build the complete project within the 2.5-hour constraint, including the AI-agent usage and documentation.

What Auriga is actually testing

This isn't just a "make a CRUD app" test. From the mail, they are checking whether you can:

Read an ambiguous problem statement.
Decide the missing requirements yourself.
Break the problem into features.
Choose a suitable stack.
Use AI effectively rather than blindly copying.
Build a working product quickly.
Make reasonable UI/UX decisions.
Explain your technical reasoning.
Show the actual AI conversation used during development.
The three files are mandatory

We'll make sure the final repository contains:

habit-tracker/
│
├── src/
├── public/
├── ...
│
├── README.md
├── REASONING.md
└── AI_LOGS.md

README.md

Project overview
Features
Tech stack
How to install
How to run
Environment variables, if any
Project structure
How to use the application
Debugging/troubleshooting
Design decisions where useful

REASONING.md

How we interpreted the problem
Requirements we derived
Feature decisions
Architecture
Data model
UI/UX decisions
Why we selected the technology
AI-assisted decisions
Problems encountered
Bugs and fixes
Trade-offs
What we would improve with more time

AI_LOGS.md

The actual AI conversation
Kept as-is
No rewriting the conversation afterward

That last one is especially important: we should maintain the AI log during the build rather than trying to reconstruct it at the end.

One thing I need first

The actual habit_tracker problem statement from the Google Doc isn't accessible from the link you pasted on my side.

Please upload the habit_tracker document here (PDF/DOCX/screenshot is fine), or paste its contents.

Once I have that, I'll do this with you:

Phase 1 — 10 minutes

Extract the requirements and decide:

Core requirements
↓
Derived requirements
↓
MVP features
↓
Nice-to-have features
↓
Tech stack
↓
Database/schema
↓
UI screens
Phase 2 — Build

We'll build a complete but realistic product, not an over-engineered one.

For example, depending on the actual statement:

Dashboard
├── Today's habits
├── Completion %
├── Streak
└── Weekly progress

Habits
├── Create
├── Edit
├── Delete
├── Mark complete
└── Track streak

Analytics
├── Weekly
├── Monthly
└── Completion history

But I won't assume these are requirements until I see Auriga's actual problem statement.

Phase 3 — AI agent

Since Auriga explicitly allows AI assistance, we can use an agent strategically:

Problem statement
       ↓
AI → requirements analysis
       ↓
AI → architecture
       ↓
AI → implementation
       ↓
You + AI → debugging
       ↓
AI → testing/review
       ↓
AI → documentation

The important part is that you understand what gets built. In an interview, they can easily ask:

"Why did you use this architecture?"

"Why did you choose this database?"

"How does the streak calculation work?"

"What did the AI do and what did you personally decide?"

You need to be able to answer those.

Our 2.5-hour strategy

I would roughly use:

Time	Work
0–10 min	Understand problem + requirements
10–20 min	Architecture + UI/data model
20–90 min	Main implementation
90–115 min	Features + polish
115–130 min	Testing + bug fixing
130–140 min	README + REASONING
140–145 min	AI_LOGS + final cleanup
145–150 min	GitHub push + final verification

Don't spend 90 minutes making the UI beautiful and then discover that the project isn't working. Functional MVP first, polish second.

Upload the actual habit_tracker problem statement now. Then I'll turn it into a precise build plan and we'll start building it step-by-step.

SING SYS SOFTWARE SERVICES PRIVATE LIMITED

Web Development Company in India

Custom websites & web apps built for performance and scalability. Talk to our web dev experts.

Ad
More options

Perfect. GitHub Codespaces is exactly what Auriga requires, so we should optimize everything for it.

Use this exact stack
React
Vite
JavaScript
Tailwind CSS
Lucide React
localStorage

No backend.

⏱️ First 10 minutes in Codespaces

Open the Codespace terminal and run:

npm create vite@latest . -- --template react
npm install
npm install lucide-react

Then:

npm run dev -- --host 0.0.0.0

Codespaces should give you a forwarded port/preview.

If Tailwind setup takes time

Don't waste assessment time fighting Tailwind.

We can use normal CSS instead:

React + Vite
JavaScript
CSS
Lucide React
localStorage

Honestly, for a strict 2.5-hour round, plain CSS is completely acceptable and removes dependency/setup risk.

🏗️ Our build structure

We'll create:

src/
├── components/
│   ├── HabitCard.jsx
│   ├── HabitForm.jsx
│   ├── Header.jsx
│   └── Progress.jsx
│
├── utils/
│   ├── streaks.js
│   └── storage.js
│
├── App.jsx
├── App.css
├── index.css
└── main.jsx

README.md
REASONING.md
AI_LOGS.md
Core flow
                App
                 │
       ┌─────────┴─────────┐
       │                   │
     Today              Habits
       │                   │
       ↓                   ↓
 Complete             Add / Edit
       │                   │
       ↓                   ↓
   Streaks ←────────── Habit Data
       │
       ↓
   localStorage
⚠️ Very important for your AI logs

Since AI_LOGS.md is mandatory, from the moment we start generating implementation with AI, keep the conversation.

Don't modify it afterward.

For example, if you're using GitHub Copilot Chat inside Codespaces, keep/export the actual Copilot conversation according to whatever interface you're using.

If you're using ChatGPT as the AI assistant, we'll need to preserve the actual relevant conversation in the format Auriga expects rather than creating a fake log at the end.

Before we write code

Since you're already inside the Codespace, don't run a bunch of commands yet.

Tell me what you currently see in the Codespace terminal — for example:

~/habit-tracker $

and whether the repository is empty or already contains files.

Then I'll give you the first exact command, and we'll build this in a controlled 150-minute sequence.



Yes. You have already done the initial project structure, so now we should move straight into implementation. You have a strict 150-minute limit, so don't spend more time restructuring.

One important correction from your screenshot:

Auriga specifically requires README.md + REASONING.md + AI_LOGS.md.

You currently have:

ai.md
reasoning.md
README.md

Rename them now:

mv ai.md AI_LOGS.md
mv reasoning.md REASONING.md
🚀 NEXT: Build the MVP

We should follow this exact order.

STEP 1  → Data model + localStorage
STEP 2  → Streak engine
STEP 3  → Habit CRUD
STEP 4  → Today's dashboard
STEP 5  → Search + archive
STEP 6  → UI polish
STEP 7  → Testing
STEP 8  → Documentation
STEP 9  → GitHub submission

Do not start with UI.

The most important thing in this problem is:

logging + streaks

STEP 1 — Check your current project

In Codespace terminal run:

npm run lint

Then:

npm run dev -- --host 0.0.0.0

Make sure the default Vite page opens.

If it works, stop there.

STEP 2 — Install icons

Run:

npm install lucide-react

That's the only additional library I'd add.

We don't need:

❌ Redux
❌ Axios
❌ React Router
❌ date-fns
❌ Firebase
❌ MongoDB
❌ Express

For this assessment, fewer dependencies = fewer problems.

STEP 3 — Create the folders

Inside src, create:

src/
├── components/
│   ├── HabitCard.jsx
│   ├── HabitForm.jsx
│   ├── Header.jsx
│   └── Progress.jsx
│
├── utils/
│   ├── streaks.js
│   ├── dates.js
│   └── storage.js
│
├── App.jsx
├── App.css
├── index.css
└── main.jsx

Don't create 20 components. We're under time pressure.

STEP 4 — Define our data model

This is what I want us to use:

{
  id: "1",
  name: "Drink Water",
  description: "Drink 3 litres of water",
  icon: "💧",
  frequency: "daily",
  weekdays: [],
  createdAt: "2026-09-16",
  archived: false,
  completions: [
    "2026-09-14",
    "2026-09-15",
    "2026-09-16"
  ]
}

For a weekday habit:

{
  id: "2",
  name: "Workout",
  description: "30 minutes workout",
  icon: "🏋️",
  frequency: "weekdays",
  weekdays: [1, 2, 3, 4, 5],
  createdAt: "2026-09-16",
  archived: false,
  completions: []
}

We'll use:

0 = Sunday
1 = Monday
2 = Tuesday
3 = Wednesday
4 = Thursday
5 = Friday
6 = Saturday
STEP 5 — Build storage.js

This handles persistence.

const STORAGE_KEY = "ananya-habit-tracker";

export function loadHabits() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveHabits(habits) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

This means:

React state
     ↓
localStorage
     ↓
refresh browser
     ↓
data still exists
STEP 6 — Build streak engine

This is the most important technical component.

Create:

src/utils/streaks.js

We need these functions:

isHabitScheduledOnDate()
getCurrentStreak()
getBestStreak()
Why separate them?

Because then your App.jsx doesn't become a 500-line mess.

Architecture:

HabitCard
    ↓
getCurrentStreak(habit)
getBestStreak(habit)
STEP 7 — Then build the app

Once the streak engine is working:

App
 │
 ├── Header
 │
 ├── Dashboard
 │     ├── Challenge progress
 │     ├── Today's progress
 │     └── Today's habits
 │
 └── Habits management
       ├── Search
       ├── Add
       ├── Edit
       ├── Archive
       └── Unarchive
🎯 Our MVP screen

The first screen should immediately communicate the purpose:

┌───────────────────────────────────────────────┐
│  ANANYA'S 75-DAY CHALLENGE             🔥    │
│                                               │
│  Day 23 of 75                                 │
│  ███████████████░░░░░░░                       │
│                                               │
│  TODAY                                        │
│  3 of 5 habits completed                     │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ 💧 Drink Water                         │  │
│  │ Every day                               │  │
│  │ 🔥 12 day streak   🏆 Best: 21         │  │
│  │                              ✓ Done     │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ 📚 Read                                │  │
│  │ Weekdays                                │  │
│  │ 🔥 8 day streak    🏆 Best: 14         │  │
│  │                              ○ Complete │  │
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘

That's enough to look like a real product.

⏱️ Your time checkpoints

Keep this beside you during the test:

At 30 min

You should have:

☑ React running
☑ Data model
☑ localStorage
☑ Add habit
At 60 min
☑ Add
☑ Edit
☑ Delete/archive
☑ Complete habit
☑ Persistence
At 90 min
☑ Current streak
☑ Best streak
☑ Daily frequency
☑ Weekday frequency
At 120 min
☑ Search
☑ Today's dashboard
☑ 75-day progress
At 135 min

STOP ADDING FEATURES.

Start:

☑ Bug testing
☑ UI polish
☑ Empty states
145–150 min
☑ README.md
☑ REASONING.md
☑ AI_LOGS.md
☑ npm run lint
☑ npm run build
☑ git status
☑ git push
⚠️ One very important thing about AI_LOGS.md

From this point onward, keep the actual AI conversation you use for implementation.

Don't later create something like:

AI_LOGS.md

User: Build a habit tracker.
AI: Sure...

if that wasn't the actual conversation.

Auriga explicitly says the AI log must be complete, as-is, and unmodified.

Also, your current ai.md should become:

AI_LOGS.md

not AI.md.

Now do only this

Run these commands in your Codespace:

mv ai.md AI_LOGS.md
mv reasoning.md REASONING.md
npm install lucide-react
npm run lint

Then tell me whether npm run lint passes or shows errors.

After that, we'll implement storage.js + streaks.js first. That's the foundation, and I'll keep the implementation optimized for the 2.5-hour Auriga assessment.


