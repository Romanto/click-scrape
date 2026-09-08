# Nestix Privacy Policy

**Last updated:** September 8, 2026

**Permanent URL:** https://nestix.app/privacy  
**Temporary URL:** https://romanto.github.io/click-scrape/privacy.html

---

## Introduction

Nestix is a Chrome extension that helps you extract structured data from web pages using a visual point-and-click interface. This privacy policy explains how Nestix handles your data.

## What Nestix Does

Nestix allows you to:
- Select elements on web pages to define data extraction patterns ("recipes")
- Preview extracted data in an editable table
- Export data as CSV or JSON files
- Save recipes locally for reuse

## Data Collection and Storage

**All data stays on your device.** Nestix:

- **Accesses page content** only when you are actively picking fields or running a recipe on a web page
- **Stores recipes locally** using Chrome's `chrome.storage.local` API — recipes never leave your device
- **Downloads exports locally** — CSV and JSON files are saved to your computer's Downloads folder
- **Does NOT upload** any scraped data, recipes, or browsing information to external servers
- **Does NOT require** an account or login
- **Does NOT sell** your data to third parties
- **Does NOT use** your data for advertising purposes
- **Does NOT implement** "phone-home" soft caps or usage tracking

## Permissions Used

Nestix requires the following Chrome permissions:

- **activeTab** — to access the content of the web page you're currently viewing when you activate picking or run a recipe
- **scripting** — to inject the picker interface and extraction logic into web pages
- **storage** — to save your recipes locally in Chrome's local storage
- **host_permissions (optional)** — to enable recipe execution on specific domains you choose

These permissions are used solely to provide the core scraping functionality described above.

## Data Retention

- **Recipes** remain in local Chrome storage until you delete them through the extension interface or uninstall the extension
- **Exported data** remains in your Downloads folder until you delete it
- **Uninstalling** the extension removes all locally stored recipes

## Third-Party Services

Nestix does not integrate with or transmit data to any third-party services. The extension operates entirely on your device.

**Chrome Web Store:** This extension is distributed through the Chrome Web Store, which is operated by Google. Google's privacy policies apply to your use of the Chrome Web Store itself. Nestix does not control or have access to any analytics or data that Google may collect through the Web Store.

## Children's Privacy

Nestix is not intended for use by children under 13 years of age. We do not knowingly collect information from children under 13.

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last updated" date at the top of this policy. Continued use of Nestix after changes constitutes acceptance of the updated policy.

## Contact

If you have questions about this privacy policy, you can:
- Contact us through the email address listed in the Chrome Web Store listing
- Visit https://nestix.app (when live) for additional contact options

---

**Summary:** Nestix is a local-first tool. Your scraped data and recipes stay on your device. We don't upload, track, or sell your data.
