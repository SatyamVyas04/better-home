# better-home

A minimal, sleek new tab Chrome extension with tasks, quick links, and a mood calendar.

## Features

- **Tasks** - Simple todo list to track what needs to be done
- **Quick Links** - Save your favorite websites with one click
- **Mood Calendar** - Track your daily mood throughout 2026 with beautiful animations
  - Quadrimester and full year views
  - Animated transitions with blur effects
  - Toggle date numbers on/off
  - Add notes to each day
- **Dark/Light Mode** - Toggle between themes
- **Responsive** - Works on all screen sizes
- **Customizable** - Toggle widgets on/off from the popup

## Installation

### From Source (Development)

1. **Clone the repository**

   ```bash
   git clone https://github.com/SatyamVyas04/better-home.git
   cd better-home
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Build the extension**

   ```bash
   bun run build
   ```

4. **Load as unpacked extension in Chrome/Edge**

   - Open Chrome and go to `chrome://extensions`
   - Enable **Developer mode** (toggle in top right)
   - Click **Load unpacked**
   - Select the `dist` folder from the project directory
   - Open a new tab to see better-home in action!

### Development Mode

Run the development server with hot reload:

```bash
bun run dev
```

Note: For extension development, you'll need to rebuild and reload the extension after changes.

## Tech Stack

- [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vite.dev) - Build tool
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [shadcn/ui](https://ui.shadcn.com) - UI components
- [Motion](https://motion.dev) - Animations
- [Tabler Icons](https://tabler.io/icons) - Icons
- [Bun](https://bun.sh) - Package manager

## License

MIT

## Author

**Satyam Vyas**

- [LinkedIn](https://www.linkedin.com/in/satyam-vyas/)
- [GitHub](https://github.com/SatyamVyas04)
- [X/Twitter](https://x.com/SatyamVyas04)
