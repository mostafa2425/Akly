# Akly — Arabic RTL Meal Planner

Akly is a mobile-first React + Vite meal planner with an Arabic RTL interface.

## Features

- Daily meal recommendations and food logging
- Food library with search, meal/source filters, favorites, and custom meals
- Nutrition tracking for calories, protein, carbohydrates, fat, and fiber
- Weekly meal planning and a starter shopping list
- Weight history and monthly food-budget tracking
- JSON backup export/import
- Mobile bottom navigation and quick-add actions
- Local browser storage; no account or backend is required

## Requirements

- Node.js 20 or newer
- npm

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Deployment

The project is configured for Vercel using `vercel.json`. Connect this repository to Vercel and deploy the `main` branch.

## Data and privacy

Meal logs, preferences, weekly plans, and weight entries are stored in the current browser's local storage. Use the in-app JSON backup feature to export or transfer them. Nutrition values are estimates and should be verified for individual ingredients and portions.
