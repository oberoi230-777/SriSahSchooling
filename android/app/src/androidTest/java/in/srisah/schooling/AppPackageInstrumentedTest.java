package in.srisah.schooling;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Instrumented smoke test. Run on a connected device or emulator with:
 *   cd android && ./gradlew connectedDebugAndroidTest
 */
@RunWith(AndroidJUnit4.class)
public class AppPackageInstrumentedTest {

    @Test
    public void applicationIdMatchesThePublishedPackage() {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        // Debug builds carry the .debug suffix so they can be installed next to a Play build.
        String packageName = appContext.getPackageName();
        assertTrue("unexpected application id: " + packageName,
            packageName.equals("in.srisah.schooling") || packageName.equals("in.srisah.schooling.debug"));
    }

    @Test
    public void appLabelIsBranded() {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertNotNull(appContext.getString(R.string.app_name));
    }
}
