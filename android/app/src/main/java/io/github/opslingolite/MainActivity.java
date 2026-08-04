package io.github.opslingolite;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(OfflineNeuralSpeechPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
