Primary action control for SSMSX — use `primary` for the main action in a view (Connect, Execute), `ghost` for toolbar actions, `secondary`/`dashed` for low-emphasis, `danger` for destructive.

```jsx
<Button variant="primary" size="sm">Connect</Button>
<Button variant="ghost" size="xs" leadingIcon={<RunIcon/>}>Execute</Button>
<Button variant="dashed" size="xs">+ New Connection</Button>
<Button variant="danger" size="sm">Delete</Button>
```

Variants: `primary` `secondary` `ghost` `dashed` `danger`. Sizes: `xs` `sm` `md`. Pass `disabled` to dim + block.
