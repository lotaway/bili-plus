import { createGlobalStyle } from 'styled-components'

export const SidepanelGlobalStyle = createGlobalStyle`
  :root {
    --sp-text: #173853;
    --sp-muted: #557792;
    --sp-border: #d6e7f6;
  }

  body.sidepanel-contain {
    margin: 0;
    padding: 0;
    color: var(--sp-text);
    background:
      radial-gradient(circle at 5% 0%, #e4f3ff 0%, rgba(228, 243, 255, 0) 42%),
      radial-gradient(circle at 100% 100%, #e8f4ff 0%, rgba(232, 244, 255, 0) 38%),
      linear-gradient(180deg, #f7fbff 0%, #eef6ff 100%);
  }

  #root {
    height: 100vh;
  }

  .sidepanel-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 12px;
    box-sizing: border-box;
    gap: 10px;
  }

  .sidepanel-header {
    padding: 12px;
    border: 1px solid var(--sp-border);
    border-radius: 14px;
    background: linear-gradient(135deg, #ffffff 0%, #f3f9ff 100%);
    box-shadow: 0 8px 18px rgba(24, 85, 133, 0.08);
  }

  .sidepanel-kicker {
    margin: 0 0 4px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #197abc;
  }

  .sidepanel-header h2 {
    margin: 0;
    font-size: 18px;
    line-height: 1.25;
    color: #183b5a;
  }

  .sidepanel-subtitle {
    margin: 6px 0 0;
    font-size: 12px;
    color: var(--sp-muted);
  }

  .sidepanel-main {
    flex: 1;
    min-height: 0;
  }

  .sidepanel-main button {
    border-radius: 9px;
  }

  .sidepanel-main input,
  .sidepanel-main textarea,
  .sidepanel-main select {
    border-radius: 8px;
    border: 1px solid #c8dff2;
  }

  .sidepanel-main input:focus,
  .sidepanel-main textarea:focus,
  .sidepanel-main select:focus {
    outline: none;
    border-color: #58abe4;
    box-shadow: 0 0 0 3px rgba(88, 171, 228, 0.2);
  }
`
