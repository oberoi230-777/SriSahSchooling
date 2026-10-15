package in.srisah.schooling;

import static org.junit.Assert.assertTrue;

import org.junit.Test;

/**
 * JVM unit test. Run with:
 *   cd android && ./gradlew testDebugUnitTest
 */
public class AppConfigurationUnitTest {

    @Test
    public void releaseVersionIsConfigured() {
        String versionName = BuildConfig.VERSION_NAME;
        assertTrue("versionName must be set for Play uploads", versionName != null && !versionName.isEmpty());
        assertTrue("versionCode must be positive", BuildConfig.VERSION_CODE > 0);
    }

    @Test
    public void applicationIdIsThePublishedPackage() {
        assertTrue(BuildConfig.APPLICATION_ID.startsWith("in.srisah.schooling"));
    }
}
