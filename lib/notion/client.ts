import { Client } from "@notionhq/client";

export const notion = new Client({
    auth: process.env.NOTION_API_KEY,
});

// Helper to check if Notion is configured
export const isNotionConfigured = () => {
    return !!process.env.NOTION_API_KEY;
};
