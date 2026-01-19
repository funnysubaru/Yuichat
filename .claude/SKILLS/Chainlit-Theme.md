# Chainlit Theme Customisation

Chainlit's theme is based on CSS variables.

To modify the CSS variables, create a `theme.json` file under `/public` with the following content.

You can check [Shadcn's documentation](https://ui.shadcn.com/docs/theming) to learn about the role of each variable.

## Example theme.json

```json
{
    "custom_fonts": [],
    "variables": {
        "light": {
            "--font-sans": "'Inter', sans-serif",
            "--font-mono": "source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace",
            "--background": "0 0% 100%",
            "--foreground": "0 0% 5%",
            "--card": "0 0% 100%",
            "--card-foreground": "0 0% 5%",
            "--popover": "0 0% 100%",
            "--popover-foreground": "0 0% 5%",
            "--primary": "340 92% 52%",
            "--primary-foreground": "0 0% 100%",
            "--secondary": "210 40% 96.1%",
            "--secondary-foreground": "222.2 47.4% 11.2%",
            "--muted": "0 0% 90%",
            "--muted-foreground": "0 0% 36%",
            "--accent": "0 0% 95%",
            "--accent-foreground": "222.2 47.4% 11.2%",
            "--destructive": "0 84.2% 60.2%",
            "--destructive-foreground": "210 40% 98%",
            "--border": "0 0% 90%",
            "--input": "0 0% 90%",
            "--ring": "340 92% 52%",
            "--radius": "0.75rem",
            "--sidebar-background": "0 0% 98%",
            "--sidebar-foreground": "240 5.3% 26.1%",
            "--sidebar-primary": "240 5.9% 10%",
            "--sidebar-primary-foreground": "0 0% 98%",
            "--sidebar-accent": "240 4.8% 95.9%",
            "--sidebar-accent-foreground": "240 5.9% 10%",
            "--sidebar-border": "220 13% 91%",
            "--sidebar-ring": "217.2 91.2% 59.8%"
        },
        "dark": {
            "--font-sans": "'Inter', sans-serif",
            "--font-mono": "source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace",
            "--background": "0 0% 13%",
            "--foreground": "0 0% 93%",
            "--card": "0 0% 18%",
            "--card-foreground": "210 40% 98%",
            "--popover": "0 0% 18%",
            "--popover-foreground": "210 40% 98%",
            "--primary": "340 92% 52%",
            "--primary-foreground": "0 0% 100%",
            "--secondary": "0 0% 19%",
            "--secondary-foreground": "210 40% 98%",
            "--muted": "0 1% 26%",
            "--muted-foreground": "0 0% 71%",
            "--accent": "0 0% 26%",
            "--accent-foreground": "210 40% 98%",
            "--destructive": "0 62.8% 30.6%",
            "--destructive-foreground": "210 40% 98%",
            "--border": "0 1% 26%",
            "--input": "0 1% 26%",
            "--ring": "340 92% 52%",
            "--sidebar-background": "0 0% 9%",
            "--sidebar-foreground": "240 4.8% 95.9%",
            "--sidebar-primary": "224.3 76.3% 48%",
            "--sidebar-primary-foreground": "0 0% 100%",
            "--sidebar-accent": "0 0% 13%",
            "--sidebar-accent-foreground": "240 4.8% 95.9%",
            "--sidebar-border": "240 3.7% 15.9%",
            "--sidebar-ring": "217.2 91.2% 59.8%"
        }
    }
}
```

## CSS Variable Format

The color values use HSL format without the `hsl()` wrapper:
- Format: `"H S% L%"` (Hue, Saturation, Lightness)
- Example: `"340 92% 52%"` means `hsl(340, 92%, 52%)`

## Key Variables

| Variable | Description |
|----------|-------------|
| `--primary` | Primary brand color (buttons, links) |
| `--background` | Page background color |
| `--foreground` | Main text color |
| `--card` | Card background color |
| `--muted` | Muted/disabled element color |
| `--accent` | Accent color for highlights |
| `--destructive` | Error/danger color |
| `--border` | Border color |
| `--input` | Input field border color |
| `--ring` | Focus ring color |
| `--radius` | Border radius |

## Custom CSS

Chainlit Application allows for design customization through the use of a custom CSS stylesheet. To enable this, modify your configuration settings in `.chainlit/config.toml`.

```toml
[UI]
# ...
# This can either be a css file in your `public` dir or a URL
custom_css = '/public/stylesheet.css'
```

### Usage

1. Create a CSS file in your `public` directory (e.g., `public/stylesheet.css`)
2. Add the `custom_css` configuration to your `.chainlit/config.toml`
3. Write your custom CSS rules to override default styles

### Example Custom CSS

```css
/* Override primary button color */
.cl-button-primary {
    background-color: hsl(var(--primary));
}

/* Custom message styling */
.cl-message {
    border-radius: var(--radius);
}
```

## Reference

- [Chainlit Theme Documentation](https://docs.chainlit.io/customisation/theme)
- [Chainlit Custom CSS Documentation](https://docs.chainlit.io/customisation/css)
- [Shadcn Theming](https://ui.shadcn.com/docs/theming)
