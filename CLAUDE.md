\# Camping Israel Project

A cross-platform mobile app and website for locating night camps and campsites in Israel.



\## Tech Stack

\- Frontend: React Native (Expo)

\- Backend: Node.js (TypeScript) + Express

\- Database: PostgreSQL (Supabase)



\## Agent Development Guidelines

\- Always use TypeScript for both frontend and backend. Ensure strict typing.

\- Strictly separate the API routing layer from the business logic.

\- For UI/UX design, prioritize a mobile-first approach and use compatible component libraries.

\- When modifying or creating the campsite data model, ensure support for essential fields: name, coordinates (lat/lng), price per night, opening hours, and available amenities (e.g., water, electricity, toilets).

\- Do not install new npm dependencies without asking for confirmation first.

\- Document complex logic, especially geospatial queries or external API integrations.



## Current status

See `docs/HANDOFF.md` for where work left off and what to do next.
