import threading
import subprocess
import http.server
import socketserver
import os
import time
import sys
import webbrowser # To automatically open the browser

# --- Configuration ---
# Port for the AKTools API server
AKTOOLS_PORT = 8080
# Port for the frontend HTTP server (serving HTML/CSS/JS)
FRONTEND_PORT = 8000
# Directory containing your HTML, CSS, JS files (relative to this script)
# '.' means the script is INSIDE the 'stock_analyzer_frontend' directory
# 'stock_analyzer_frontend' means the script is OUTSIDE, in the parent directory
FRONTEND_DIR = '.'
# The main HTML file you want to open automatically
MAIN_HTML_FILE = 'stock_list.html'
# --- End Configuration ---

aktools_process = None

def start_aktools_server(port):
    """Starts the AKTools server as a subprocess."""
    global aktools_process
    print(f"Attempting to start AKTools API server on port {port}...")
    # Use sys.executable to ensure we use the same Python interpreter
    command = [sys.executable, '-m', 'aktools', '--port', str(port)]
    try:
        # Start the process. Redirect output if desired (or let it print to console).
        # Use creationflags on Windows to prevent extra console window (optional)
        kwargs = {}
        if sys.platform == "win32":
             # subprocess.CREATE_NO_WINDOW flag prevents console window popup
             # Note: This also hides AKTools output unless you pipe it.
             # Remove this if you WANT to see the AKTools output in a separate window/console.
             # kwargs['creationflags'] = subprocess.CREATE_NO_WINDOW
             pass # Keep console output for debugging initially

        aktools_process = subprocess.Popen(command, **kwargs) #stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"AKTools API server process started (PID: {aktools_process.pid}). Listening on http://localhost:{port}")
        print("AKTools output will appear in this console (unless redirected).")

    except FileNotFoundError:
        print(f"Error: Command '{sys.executable} -m aktools' not found.")
        print("Please ensure:")
        print("1. Python is correctly installed and in your system's PATH.")
        print("2. The 'aktools' package is installed in the current Python environment (`pip install aktools`).")
        sys.exit(1)
    except Exception as e:
        print(f"Error starting AKTools API server: {e}")
        sys.exit(1)

def start_frontend_server(directory, port):
    """Starts a simple HTTP server for the frontend files."""
    print(f"Attempting to start frontend server for directory '{os.path.abspath(directory)}' on port {port}...")
    try:
        # Handler that serves files from the *current* working directory
        Handler = http.server.SimpleHTTPRequestHandler
        # Create the server, binding to all interfaces on the specified port
        httpd = socketserver.TCPServer(("", port), Handler)

        # Change directory *after* creating server but *before* serving forever
        # This ensures the server serves files from the correct directory
        os.chdir(directory)
        print(f"Frontend server running. Access at: http://localhost:{port}/{MAIN_HTML_FILE}")
        httpd.serve_forever() # This blocks the thread until stopped
    except FileNotFoundError:
         print(f"Error: Frontend directory '{os.path.abspath(directory)}' not found.")
         # Attempt to kill aktools if frontend fails
         if aktools_process and aktools_process.poll() is None:
              aktools_process.terminate()
         sys.exit(1)
    except OSError as e:
         print(f"Error starting frontend server: {e}")
         print(f"Is port {port} already in use?")
         if aktools_process and aktools_process.poll() is None:
              aktools_process.terminate()
         sys.exit(1)
    except Exception as e:
        print(f"Error running frontend server: {e}")
        if aktools_process and aktools_process.poll() is None:
              aktools_process.terminate()
        sys.exit(1)

def open_browser(url):
    """Opens the specified URL in the default web browser."""
    print(f"Opening frontend in browser: {url}")
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"Could not automatically open browser: {e}")
        print(f"Please manually navigate to {url}")

if __name__ == "__main__":
    # --- Determine Absolute Path for Frontend Directory ---
    script_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_abs_path = os.path.abspath(os.path.join(script_dir, FRONTEND_DIR))

    if not os.path.isdir(frontend_abs_path):
        print(f"Error: Resolved frontend directory '{frontend_abs_path}' not found.")
        print(f"Please check the FRONTEND_DIR setting ('{FRONTEND_DIR}') in the script.")
        sys.exit(1)

    # --- Start AKTools in the main process flow (or a thread if preferred) ---
    # Running AKTools first to ensure API is ready when frontend loads
    start_aktools_server(AKTOOLS_PORT)
    # Give AKTools a few seconds to initialize before starting frontend/browser
    print("Waiting a few seconds for AKTools to initialize...")
    time.sleep(4) # Adjust if needed

    # --- Start Frontend Server in a Separate Thread ---
    # Pass the absolute path to the frontend directory
    # Make it a daemon thread so it exits when the main script exits
    frontend_thread = threading.Thread(
        target=start_frontend_server,
        args=(frontend_abs_path, FRONTEND_PORT,),
        daemon=True
    )
    frontend_thread.start()

    # --- Wait a moment for frontend server to bind ---
    time.sleep(1)

    # --- Open the main HTML page in the browser ---
    frontend_url = f"http://localhost:{FRONTEND_PORT}/{MAIN_HTML_FILE}"
    open_browser(frontend_url)

    # --- Keep the main script alive & handle shutdown ---
    print("\nServers are running.")
    print(f" - AKTools API: http://localhost:{AKTOOLS_PORT}")
    print(f" - Frontend:    http://localhost:{FRONTEND_PORT}/{MAIN_HTML_FILE}")
    print("\nPress Ctrl+C in this terminal to stop both servers.")

    try:
        # Keep the main thread alive. The frontend server runs in a daemon thread.
        # We primarily need to wait for the AKTools process or user interrupt.
        while True:
            if aktools_process.poll() is not None: # Check if AKTools process has terminated
                print("AKTools process seems to have stopped unexpectedly.")
                break
            time.sleep(1) # Check periodically

    except KeyboardInterrupt:
        print("\nCtrl+C received. Shutting down...")
    finally:
        # Terminate the AKTools subprocess gracefully
        if aktools_process and aktools_process.poll() is None: # Check if running
            print("Terminating AKTools process...")
            aktools_process.terminate() # Send SIGTERM
            try:
                aktools_process.wait(timeout=5) # Wait up to 5 seconds
                print("AKTools process terminated gracefully.")
            except subprocess.TimeoutExpired:
                print("AKTools process did not respond to terminate, killing...")
                aktools_process.kill() # Force kill
                print("AKTools process killed.")
        else:
            print("AKTools process already stopped or not started.")

        # Frontend server thread is a daemon, it will exit automatically.
        print("Frontend server thread will exit.")
        print("Script finished.")
