import { createGlobalStyle } from 'styled-components'

export const PopupGlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 10px;
    font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    background:
      radial-gradient(circle at 10% 0%, #e8f6ff 0%, rgba(232, 246, 255, 0) 40%),
      radial-gradient(circle at 100% 100%, #eef7ff 0%, rgba(238, 247, 255, 0) 35%),
      linear-gradient(180deg, #f8fcff 0%, #f2f8ff 100%);
  }

  .popup-contain {
    width: 360px;
    min-height: 520px;
  }

  .popup {
    color: #16324a;
  }

  .popup-header {
    margin-bottom: 12px;
    padding: 14px;
    border: 1px solid #d6e7f6;
    border-radius: 14px;
    background: linear-gradient(135deg, #ffffff 0%, #f1f8ff 100%);
    box-shadow: 0 8px 18px rgba(19, 75, 120, 0.08);
  }

  .popup-kicker {
    margin: 0 0 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #1c78b8;
  }

  .popup h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #183b5a;
  }

  .popup-subtitle {
    margin: 6px 0 0;
    font-size: 12px;
    color: #4d6b86;
  }

  .popup-card {
    margin-bottom: 12px;
    padding: 12px;
    border: 1px solid #d6e7f6;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 6px 14px rgba(19, 75, 120, 0.05);
  }

  .popup-subcard {
    margin-top: 10px;
    padding: 10px;
    border: 1px solid #dceaf8;
    border-radius: 10px;
    background: #f7fbff;
  }

  .config-section {
    margin-bottom: 15px;
    padding-bottom: 4px;
    border-bottom: none;
  }

  .config-section h4 {
    margin: 0 0 10px 0;
    font-size: 14px;
    color: #315777;
  }

  .providers-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .provider-item {
    padding: 10px;
    border: 1px solid #ddeaf6;
    border-radius: 10px;
    background: #fff;
  }

  .provider-item.active {
    border-color: #77bbe9;
    background: #f2f9ff;
  }

  .provider-info {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .provider-name {
    font-weight: 600;
    color: #1f4768;
  }

  .provider-model {
    font-size: 12px;
    color: #4e6e88;
  }

  .current-badge {
    margin-left: auto;
    padding: 2px 7px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    color: #0d5f96;
    background: #d9efff;
  }

  .provider-actions {
    display: flex;
    gap: 6px;
  }

  .provider-actions .action-btn {
    margin: 0;
    padding: 6px 0;
    font-size: 12px;
  }

  .form-group {
    margin-bottom: 10px;
  }

  .form-group label {
    display: block;
    margin-bottom: 5px;
    font-size: 12px;
    color: #466787;
    font-weight: 600;
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: 8px;
    font-size: 13px;
    border: 1px solid #c8dff2;
    border-radius: 8px;
    box-sizing: border-box;
    background-color: #fff;
    color: #183b5a;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: #5caee6;
    box-shadow: 0 0 0 3px rgba(92, 174, 230, 0.2);
  }

  .form-group select {
    background-color: white;
    cursor: pointer;
  }

  .form-group select:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
    opacity: 0.6;
  }

  button {
    display: block;
    width: 100%;
    padding: 9px;
    font-size: 13px;
    font-weight: 600;
    border: none;
    border-radius: 9px;
    background: linear-gradient(135deg, #1a91d8 0%, #0f74bc 100%);
    color: #fff;
    cursor: pointer;
    margin-bottom: 8px;
    transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
  }

  .refresh-models-btn {
    width: auto;
    padding: 4px 12px;
    font-size: 12px;
    margin-top: 5px;
    background: linear-gradient(135deg, #71828f 0%, #5f7080 100%);
  }

  .refresh-models-btn:hover {
    background: linear-gradient(135deg, #677a88 0%, #536675 100%);
  }

  .refresh-models-btn:disabled {
    background: #adb5bd;
    cursor: not-allowed;
  }

  button:hover {
    filter: brightness(1.04);
    box-shadow: 0 6px 12px rgba(15, 116, 188, 0.25);
    transform: translateY(-1px);
  }

  .message {
    margin-top: 10px;
    padding: 8px 12px;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 500;
    text-align: center;
    transition: all 0.3s ease;
  }

  .message.success {
    background-color: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }

  .message.error {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  .study-config-section {
    margin-top: 14px;
    border-top: 1px solid #e2eef8;
    padding-top: 15px;
  }

  .study-config-section .input-group {
    display: flex;
    gap: 10px;
  }

  .study-config-section .save-btn {
    width: auto;
    white-space: nowrap;
    margin-bottom: 0;
  }

  .study-config-section .input-group input {
    flex: 1;
    width: auto;
    margin-bottom: 0;
  }

  .storage-section {
    margin-top: 4px;
  }

  .storage-info {
    margin: 4px 0 0;
    font-size: 12px;
    color: #5a7790;
  }

  .cleanup-btn,
  .cancel-btn,
  .secondary-btn,
  .delete-btn {
    background: linear-gradient(135deg, #879aab 0%, #6e7f8f 100%);
  }

  .switch-btn {
    background: linear-gradient(135deg, #23a56f 0%, #198c5c 100%);
  }

  .edit-btn,
  .add-provider-btn,
  .save-btn {
    background: linear-gradient(135deg, #1a91d8 0%, #0f74bc 100%);
  }

  .api-status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    line-height: 1.4;
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .api-status.available .status-indicator {
    background: #1ca366;
  }

  .api-status.unavailable .status-indicator {
    background: #d24a5d;
  }

  .status-text {
    font-weight: 600;
    color: #2f5677;
  }

  .status-message,
  .last-checked {
    color: #607f98;
  }

  .no-providers {
    margin: 0;
    font-size: 12px;
    color: #607f98;
  }
`
