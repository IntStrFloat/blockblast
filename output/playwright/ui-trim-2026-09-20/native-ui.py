import pathlib
import subprocess
import sys
import time

ADB = r"C:/Users/Dima2/AppData/Local/Android/Sdk/platform-tools/adb.exe"
command, *args = sys.argv[1:]
if command == "capture":
    path = pathlib.Path(__file__).parent / (args[0] + ".png")
    path.write_bytes(subprocess.check_output([ADB, "-s", "emulator-5554", "exec-out", "screencap", "-p"], timeout=15))
    print(path.resolve())
elif command == "route":
    subprocess.run([ADB, "-s", "emulator-5554", "shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "blockblast:///" + args[0], "com.intstrfloat.blockblast"], check=True, timeout=20)
    time.sleep(2)
else:
    subprocess.run([ADB, "-s", "emulator-5554", "shell", "input", command, *args], check=True, timeout=15)
