package com.codex;

import android.os.SystemClock;
import android.graphics.Bitmap;
import android.media.MediaMetadataRetriever;

import com.android.uiautomator.testrunner.UiAutomatorTestCase;

import java.io.File;
import java.io.FileOutputStream;
import java.io.FileWriter;

public final class DragTest extends UiAutomatorTestCase {
  public void testTutorialClear() throws Exception {
    getUiDevice().wakeUp();
    getUiDevice().waitForIdle(1000);
    assertTrue("Tutorial drag must complete", getUiDevice().drag(885, 1105, 477, 821, 120));
    capture("clear-exact-000.png", 0);
    capture("clear-exact-060.png", 60);
    capture("clear-exact-120.png", 60);
    capture("clear-exact-200.png", 80);
    capture("clear-exact-320.png", 120);
    capture("clear-exact-500.png", 180);
    capture("clear-exact-720.png", 220);
    capture("clear-exact-850.png", 130);
    capture("clear-exact-1000.png", 150);
    capture("clear-exact-1200.png", 200);
    capture("clear-exact-1500.png", 300);
    capture("clear-exact-2200.png", 700);
    getUiDevice().waitForIdle(1200);
  }

  public void testTutorialClearPerformance() throws Exception {
    getUiDevice().wakeUp();
    getUiDevice().waitForIdle(1000);
    assertTrue("Tutorial drag must complete", getUiDevice().drag(885, 1105, 477, 821, 120));
    // Flush the final injected UP event before the instrumentation process exits.
    // Without this barrier, legacy UIAutomator can report a successful drag while
    // the app occasionally never observes the gesture finalization.
    getUiDevice().waitForIdle(2000);
    SystemClock.sleep(1200);
  }

  public void testTutorialPraiseDuring() throws Exception {
    getUiDevice().wakeUp();
    getUiDevice().waitForIdle(1000);
    assertTrue("Tutorial drag must complete", getUiDevice().drag(885, 1105, 477, 821, 120));
    SystemClock.sleep(800);
    capture("praise-during.png", 0);
  }

  public void testTutorialPraiseAfter() throws Exception {
    getUiDevice().wakeUp();
    getUiDevice().waitForIdle(1000);
    assertTrue("Tutorial drag must complete", getUiDevice().drag(885, 1105, 477, 821, 120));
    SystemClock.sleep(1800);
    capture("praise-after.png", 0);
  }

  public void testExtractPraiseVideoFrames() throws Exception {
    MediaMetadataRetriever retriever = new MediaMetadataRetriever();
    retriever.setDataSource("/sdcard/destruction-latency.mp4");
    long[] timesMs = {
      0, 500, 1000, 1500, 2000, 2500, 3000,
      3500, 4000, 4500, 5000, 5500, 6000, 6500
    };
    try {
      for (long timeMs : timesMs) {
        Bitmap frame = retriever.getFrameAtTime(timeMs * 1000, MediaMetadataRetriever.OPTION_CLOSEST);
        assertNotNull("Video frame must exist at " + timeMs + " ms", frame);
        FileOutputStream output = new FileOutputStream("/sdcard/praise-video-" + timeMs + ".png");
        try {
          assertTrue(frame.compress(Bitmap.CompressFormat.PNG, 100, output));
        } finally {
          output.close();
          frame.recycle();
        }
      }
    } finally {
      retriever.release();
    }
  }

  public void testTutorialClearInjectedPerformance() throws Exception {
    getUiDevice().wakeUp();
    getUiDevice().waitForIdle(1000);
    long startNs = SystemClock.elapsedRealtimeNanos();
    assertTrue("Tutorial drag must complete", getUiDevice().drag(885, 1105, 477, 821, 120));
    SystemClock.sleep(2500);
    long endNs = SystemClock.elapsedRealtimeNanos();
    FileWriter writer = new FileWriter("/sdcard/injected-window.txt");
    try {
      writer.write(startNs + "," + endNs);
    } finally {
      writer.close();
    }
    capture("injected-final.png", 0);
  }

  private void capture(String name, long delayMs) {
    if (delayMs > 0) {
      SystemClock.sleep(delayMs);
    }
    assertTrue("Screenshot must be captured: " + name,
        getUiDevice().takeScreenshot(new File("/sdcard/" + name)));
  }
}
