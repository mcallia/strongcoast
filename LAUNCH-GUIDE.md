# Launch guide — 5 minutes, no credentials shared

This zip contains the finished site **including git history**. To put it live:

1. Create the repo: https://github.com/new → name **strongcoast** (exact, no spaces),
   Public, do NOT add a README. Click Create.
2. Unzip, then from inside the `site` folder run:
       git remote add origin https://github.com/mcallia/strongcoast.git
       git push -u origin main
       git push origin main:gh-pages
   (Git will prompt for your GitHub login — use a Personal Access Token as the password.)
3. That's it. Pushing `gh-pages` auto-enables GitHub Pages.
   Live in ~1 minute at: **https://mcallia.github.io/strongcoast/**
   Password: strongcoastrevised2026
4. Enable the news auto-refresh: repo → Actions tab → click "I understand… enable workflows".
   (It refreshes the newsroom every 6 hours and mirrors main → gh-pages.)
