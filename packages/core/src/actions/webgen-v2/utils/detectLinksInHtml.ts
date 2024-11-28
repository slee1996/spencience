/**
 * Extracts all links from an HTML document
 * @param html The HTML document as a string
 * @returns Array of link URLs found in the document
 */
export function detectLinksInHtml(html: string): string[] {
    // Create temporary DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Get all anchor tags
    const linkElements = doc.getElementsByTagName('a');
    
    // Extract href attributes and filter out empty/invalid ones
    const links = Array.from(linkElements)
        .map(link => link.getAttribute('href'))
        .filter((href): href is string => {
            return href !== null && 
                   href !== '' && 
                   !href.startsWith('#') && // Exclude anchor links
                   !href.startsWith('javascript:'); // Exclude javascript: links
        });

    return [...new Set(links)]; // Remove duplicates
}
