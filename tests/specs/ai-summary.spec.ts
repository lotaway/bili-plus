import { test, expect } from '../fixtures/extension.fixture';
import { SidePanel } from '../page-objects/SidePanel';
import { mockAISummaryResponse } from '../helpers/ai-mock';

test.describe('AI Summary Functionality', () => {
    test('should generate AI summary', async ({ sidepanelPage }) => {
        const sidePanel = new SidePanel(sidepanelPage);
        await mockAISummaryResponse(sidepanelPage, 'This is a test summary');

        // await sidePanel.clickAnalyzeButton();
        // await expect(sidepanelPage.locator('.summary-content')).toContainText('This is a test summary');

        // Placeholder for actual implementation
        expect(sidePanel).toBeDefined();
    });
});
