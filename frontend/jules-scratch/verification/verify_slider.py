from playwright.sync_api import sync_playwright, expect
import time

def run_verification(page):
    # Give the app time to load fully
    time.sleep(2) # Wait for client-side hydration

    # Create a container for our test component
    page.evaluate("""
        const root = document.createElement('div');
        root.id = 'test-root';
        root.style.position = 'absolute';
        root.style.top = '10px';
        root.style.left = '10px';
        root.style.padding = '20px';
        root.style.backgroundColor = 'white';
        root.style.border = '1px solid black';
        root.style.zIndex = '9999';
        document.body.appendChild(root);
    """)

    # Inject and render the Slider component using React and dynamic import
    # This relies on Vite's dev server resolving bare module imports.
    page.evaluate("""
    async () => {
        try {
            const React = await import('react');
            const ReactDOM = await import('react-dom/client');
            // The path must be relative to the project root from the browser's perspective
            const { Slider } = await import('/src/components/ui/slider.tsx');

            const e = React.createElement;
            const container = document.getElementById('test-root');
            // Add a container div for better styling and isolation
            const component = e('div', { style: { width: '300px' } },
                e('h2', { style: { marginBottom: '10px' } }, 'Verification Slider'),
                e(Slider, { defaultValue: [20, 80], max: 100 })
            );

            const root = ReactDOM.createRoot(container);
            root.render(component);
        } catch (e) {
            console.error(e);
            // If it fails, add the error to the DOM so we can see it
            const errorDiv = document.createElement('pre');
            errorDiv.id = 'error-log';
            errorDiv.textContent = e.stack;
            errorDiv.style.color = 'red';
            document.getElementById('test-root').appendChild(errorDiv);
        }
    }
    """)

    # Wait for the slider thumbs to be visible and take a screenshot
    # We target the test-root to make sure we're not picking up other sliders.
    slider_in_test_root = page.locator('#test-root [role="slider"]')
    expect(slider_in_test_root).to_have_count(2)

    # Take a screenshot of just the test container
    test_root_element = page.locator('#test-root')
    test_root_element.screenshot(path="jules-scratch/verification/verification.png")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Go to the page and wait for it to load
        page.goto("http://localhost:5173/")

        run_verification(page)
        browser.close()

if __name__ == "__main__":
    main()