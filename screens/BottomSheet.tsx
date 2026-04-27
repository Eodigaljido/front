import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function BottomSheetTest() {
  const [visible, setVisible] = useState(false);
  const [renderModal, setRenderModal] = useState(false);
  const insets = useSafeAreaInsets();
  const sheetOffY = useMemo(
    () => Math.min(300, Dimensions.get("window").height * 0.4),
    []
  );
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(sheetOffY)).current;

  useEffect(() => {
    if (visible) setRenderModal(true);
  }, [visible]);

  useEffect(() => {
    if (!renderModal) return;
    if (visible) {
      sheetTranslateY.setValue(sheetOffY);
      backdropOpacity.setValue(0);
      const id = requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 100,
            tension: 68,
          }),
        ]).start();
      });
      return () => cancelAnimationFrame(id);
    }
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: sheetOffY,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setRenderModal(false);
    });
  }, [visible, renderModal, sheetOffY]);

  return (
    <View style={styles.container}>
      <Pressable style={styles.button} onPress={() => setVisible(true)}>
        <Text style={styles.buttonText}>Open Sheet</Text>
      </Pressable>

      <Modal
        visible={renderModal}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: "rgba(0,0,0,0.45)", opacity: backdropOpacity },
            ]}
          >
            <Pressable style={{ flex: 1 }} onPress={() => setVisible(false)} />
          </Animated.View>
          <Animated.View
            style={{ transform: [{ translateY: sheetTranslateY }] }}
          >
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>Hello, world!</Text>
              <Pressable
                style={styles.closeButton}
                onPress={() => setVisible(false)}
              >
                <Text style={styles.closeText}>닫기</Text>
              </Pressable>
            </View>
            <View
              style={{
                height: Math.max(insets.bottom, 0),
                backgroundColor: "#fff",
              }}
            />
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f9",
  },
  button: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
  },
  closeButton: {
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
  },
  closeText: {
    fontWeight: "600",
    color: "#374151",
  },
});
