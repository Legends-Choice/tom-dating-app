# TOM – Dating without the bill

**Time Over Money. Don't spend money. Spend time.**

This is the complete, deployable TOM dating app. It's ready to launch on Vercel in 5 minutes.

## Quick Deploy to Vercel (5 minutes)

### Step 1: Create a GitHub account (if you don't have one)
- Go to [github.com](https://github.com) and sign up. It's free.

### Step 2: Push this code to GitHub
In your terminal, from this folder:

```bash
git add .
git commit -m "Initial TOM app commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/tom-dating-app.git
git push -u origin main
```

(Replace `YOUR_USERNAME` with your actual GitHub username)

### Step 3: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click **Sign Up** (can use your GitHub account)
3. Click **New Project**
4. Select your `tom-dating-app` repo
5. Click **Deploy**

**That's it.** Vercel will build and host it. You'll get a live URL in 2 minutes (something like `tom-dating-app.vercel.app`).

### Step 4: Point your domain
Once you buy **tomdates.com**:
1. Go to your domain registrar (GoDaddy, Namecheap, etc.)
2. Find **DNS Settings**
3. Point the domain to Vercel (Vercel shows you the exact DNS records to add in your project settings)
4. Wait 30 minutes for DNS to propagate

Then tomdates.com = your live app.

## Local Development

```bash
npm install
npm run dev
```

Opens on `http://localhost:5173`

## Build for production

```bash
npm run build
```

Creates a `dist/` folder ready to deploy.

---

**Everything works out of the box.** No API keys needed yet. Signups and photos stay in memory for now (get wiped on refresh). Real persistence (Supabase) can be added in week 2.

Good luck. Launch it.
