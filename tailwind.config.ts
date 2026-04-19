import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: 'hsl(var(--destructive))',
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		fontFamily: {
  			sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
  			display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
  			mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
  		},
  		fontSize: {
  			eyebrow: ['10px', { lineHeight: '1.2', letterSpacing: '0.25em' }],
  			micro: ['10px', { lineHeight: '1.4' }],
  			caption: ['12px', { lineHeight: '1.5' }],
  			small: ['14px', { lineHeight: '1.55' }],
  			body: ['16px', { lineHeight: '1.65' }],
  			'h3-screen': ['20px', { lineHeight: '1.2' }],
  			'h2-screen': ['28px', { lineHeight: '1.15' }],
  			'h1-screen': ['40px', { lineHeight: '1.1', letterSpacing: '-0.01em' }],
  			'hero-sm': ['48px', { lineHeight: '1.08' }],
  			hero: ['64px', { lineHeight: '1.05', letterSpacing: '-0.015em' }],
  			display: ['88px', { lineHeight: '1.02', letterSpacing: '-0.02em' }],
  		},
  		letterSpacing: {
  			eyebrow: '0.25em',
  			label: '0.12em',
  			headline: '-0.01em',
  			display: '-0.015em',
  		},
  		spacing: {
  			'section-y': '128px',
  			'section-y-sm': '80px',
  			'section-x': '32px',
  		},
  		maxWidth: {
  			container: '1200px',
  			'container-narrow': '720px',
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
