package cat.xoriguer.compactador;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(XoriguerActualitza.class);   // actualitzacions sense reinstal·lar
        super.onCreate(savedInstanceState);
    }
}
