# AL-MUHAFIZ TRACKERS - Server Troubleshooting

## Critical Issue: Incorrect Server Clock

The primary issue preventing Firebase notifications from working is that the server's clock is set to the wrong year (2025). This causes all secure connections to Google to fail.

Please follow these steps exactly on your Traccar VPS to permanently fix the time.

### Step 1: Install a Robust Time Client (Chrony)

This will replace the default time synchronization tool with a more reliable one.

```bash
sudo apt-get update && sudo apt-get install -y chrony
```

### Step 2: Configure Chrony to Use Google's Time Servers

1.  Open the configuration file for editing:
    ```bash
    sudo nano /etc/chrony/chrony.conf
    ```

2.  Add these lines to the very top of the file to ensure it syncs with reliable servers:
    ```
    server time1.google.com iburst
    server time2.google.com iburst
    ```

3.  Save the file and exit the editor (Press `Ctrl+X`, then `Y`, then `Enter`).

### Step 3: Restart Services and Verify the Fix

1.  Restart the `chrony` service to apply your changes:
    ```bash
    sudo systemctl restart chrony
    ```

2.  Wait about 10 seconds, then run this command to force an immediate sync and check the status:
    ```bash
    sudo chronyc -a makestep
    ```

3.  **Confirm the date is correct.** This is the most important step. The output must show the current year (e.g., 2024).
    ```bash
    date
    ```

### Step 4: Restart Traccar

Once the `date` command shows the correct year, restart the Traccar service.

```bash
sudo systemctl restart traccar
```

After this, the time-related errors will be gone, and your Firebase notifications should work.
