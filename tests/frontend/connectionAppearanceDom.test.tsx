// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionProfilesPanel } from "../../src/features/settings/components/ConnectionProfilesPanel";
import { SettingsDialog } from "../../src/features/settings/components/SettingsDialog";
import { useSettingsStore } from "../../src/features/settings/store/settingsStore";
import { useConnectionStore } from "../../src/features/connection/store/connectionStore";
import { ColorProfileCombobox } from "../../src/shared/components/ColorProfileCombobox";
import { ConfirmDialog } from "../../src/shared/components/ConfirmDialog";
import { ConnectionStringTab } from "../../src/features/connection/components/ConnectionStringTab";
import { ConnectionList } from "../../src/features/connection/components/ConnectionList";
import { PropertiesTab } from "../../src/features/connection/components/PropertiesTab";
import type { ConnectionInfo } from "../../src/features/connection/types";
import type { CustomColorProfile } from "../../src/features/settings/types";

const connectionApi = vi.hoisted(() => ({
  connectionList: vi.fn(),
  connectionGet: vi.fn(),
  connectionSave: vi.fn(),
  connectionDelete: vi.fn(),
  connectionTest: vi.fn(),
  connectionConnect: vi.fn(),
  connectionCancelRequest: vi.fn(),
  connectionDisconnect: vi.fn(),
  connectionReassignColorProfile: vi.fn(),
}));

vi.mock("../../src/features/connection/api/connectionApi", () => connectionApi);

const customProfile: CustomColorProfile = {
  id: "night",
  name: "Night",
  background: "#000000",
  foreground: "#FFFFFF",
  builtIn: false,
};

const linkedConnection: ConnectionInfo = {
  id: "prod",
  name: "Production",
  serverName: "sql-prod",
  authType: "SqlAuth",
  encrypt: "Mandatory",
  trustServerCertificate: false,
  colorProfileId: customProfile.id,
  createdAt: "2026-07-27T00:00:00Z",
};

function resetStores(profiles: CustomColorProfile[] = []) {
  useSettingsStore.setState({
    settings: {
      explorer: { groupTablesBySchema: true },
      workspace: { persistQueryTabs: true },
      connections: { colorProfiles: profiles },
    },
  });
  useConnectionStore.setState({
    connections: [],
    selectedConnection: null,
    activeConnectionIds: [],
    dialogOpen: false,
    dialogTab: "properties",
    loading: false,
    activeOperation: null,
    activeRequestId: null,
    activeOperationTarget: null,
    testResult: null,
    error: null,
    searchFilter: "",
    selectionVersion: 0,
    formDirty: false,
    appearanceDraft: { name: "", colorProfileId: "red" },
  });
}

function selectStoredConnection(connection: ConnectionInfo) {
  useConnectionStore.setState({
    connections: [connection],
    selectedConnection: connection,
    selectionVersion: 1,
    formDirty: false,
    appearanceDraft: {
      name: connection.name ?? "",
      colorProfileId: connection.colorProfileId ?? "red",
    },
  });
}

async function confirmProfileDeletion(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Delete" }));
  await user.click(
    await screen.findByRole("button", { name: "Delete Profile" })
  );
}

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
});

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  connectionApi.connectionList.mockResolvedValue([]);
  connectionApi.connectionSave.mockImplementation(
    async (connection: ConnectionInfo) => connection
  );
  connectionApi.connectionTest.mockResolvedValue({ success: true });
  connectionApi.connectionConnect.mockImplementation(async (id: string) => ({
    connectionId: id,
  }));
  connectionApi.connectionDelete.mockResolvedValue({ deleted: true });
  connectionApi.connectionCancelRequest.mockResolvedValue(undefined);
  connectionApi.connectionDisconnect.mockResolvedValue(undefined);
  connectionApi.connectionReassignColorProfile.mockResolvedValue({
    updatedCount: 0,
  });
  resetStores();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ConnectionList", () => {
  it("shows only the alias when present, falls back to the server name, and omits profile icons", () => {
    const unnamedConnection: ConnectionInfo = {
      ...linkedConnection,
      id: "dev",
      name: "",
      serverName: "sql-dev",
      database: "master",
      username: "developer",
    };
    resetStores([customProfile]);
    useConnectionStore.setState({
      connections: [linkedConnection, unnamedConnection],
      selectedConnection: linkedConnection,
    });

    const view = render(<ConnectionList />);
    const aliasedConnection = screen.getByRole("button", {
      name: "Production",
    });

    expect(aliasedConnection.textContent).toBe("Production");
    expect(screen.queryByText("sql-prod")).toBeNull();
    expect(screen.queryByText("master")).toBeNull();
    expect(screen.queryByText("developer")).toBeNull();
    expect(screen.getByRole("button", { name: "sql-dev" })).toBeTruthy();
    expect(view.container.querySelectorAll("[data-profile-marker]")).toHaveLength(0);
    expect(aliasedConnection.parentElement?.style.backgroundColor).toBe(
      "rgb(0, 0, 0)"
    );
    expect(aliasedConnection.parentElement?.style.color).toBe("rgb(255, 255, 255)");
  });
});

describe("ColorProfileCombobox", () => {
  const profiles = [
    {
      id: "red",
      name: "Red",
      background: "#FEF2F2",
      foreground: "#991B1B",
      builtIn: true,
    },
    {
      id: "blue",
      name: "Blue",
      background: "#EFF6FF",
      foreground: "#1D4ED8",
      builtIn: true,
    },
    {
      id: "violet",
      name: "Violet",
      background: "#F5F3FF",
      foreground: "#6D28D9",
      builtIn: true,
    },
  ];

  it("supports arrow-key selection and restores focus", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = render(
      <ColorProfileCombobox
        profiles={profiles}
        value="red"
        onChange={onChange}
      />
    );

    const combobox = screen.getByRole("combobox", {
      name: "Colour profile",
    });
    expect(combobox.style.backgroundColor).toBe("rgb(254, 242, 242)");
    expect(combobox.style.color).toBe("rgb(153, 27, 27)");
    await user.click(combobox);
    expect(screen.getByRole("option", { name: "Blue" }).style.backgroundColor).toBe(
      "rgb(239, 246, 255)"
    );
    expect(view.container.querySelectorAll("[data-profile-marker]")).toHaveLength(0);
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("blue");
    await waitFor(() => expect(document.activeElement).toBe(combobox));
    expect(combobox.getAttribute("aria-expanded")).toBe("false");
  });

  it("supports typeahead and selects pointer options on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ColorProfileCombobox
        profiles={profiles}
        value="red"
        onChange={onChange}
      />
    );

    const combobox = screen.getByRole("combobox", {
      name: "Colour profile",
    });
    combobox.focus();
    await user.keyboard("v{Enter}");
    expect(onChange).toHaveBeenCalledWith("violet");

    await user.click(combobox);
    const blueOption = screen.getByRole("option", { name: "Blue" });
    fireEvent.pointerDown(blueOption, { pointerType: "touch" });
    expect(onChange).toHaveBeenCalledOnce();
    fireEvent.click(blueOption);
    expect(onChange).toHaveBeenLastCalledWith("blue");
  });

  it("only consumes Escape while open and exposes active option navigation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ColorProfileCombobox
        profiles={profiles}
        value="blue"
        onChange={onChange}
      />
    );

    const combobox = screen.getByRole("combobox", {
      name: "Colour profile",
    });
    const closedEscape = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    fireEvent(combobox, closedEscape);
    expect(closedEscape.defaultPrevented).toBe(false);
    expect(combobox.getAttribute("aria-expanded")).toBe("false");

    combobox.focus();
    await user.keyboard("{End}");
    expect(combobox.getAttribute("aria-expanded")).toBe("true");
    expect(combobox.getAttribute("aria-activedescendant")).toBe(
      screen.getByRole("option", { name: "Violet" }).id
    );
    await user.keyboard("{Home}");
    expect(combobox.getAttribute("aria-activedescendant")).toBe(
      screen.getByRole("option", { name: "Red" }).id
    );
    await user.keyboard("{ArrowUp}");
    expect(combobox.getAttribute("aria-activedescendant")).toBe(
      screen.getByRole("option", { name: "Red" }).id
    );

    const openEscape = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    fireEvent(combobox, openEscape);
    expect(openEscape.defaultPrevented).toBe(true);
    expect(combobox.getAttribute("aria-expanded")).toBe("false");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes on an outside pointer or focus leaving the control", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <ColorProfileCombobox
          profiles={profiles}
          value="red"
          onChange={vi.fn()}
        />
        <button type="button">Outside</button>
      </div>
    );

    const combobox = screen.getByRole("combobox", {
      name: "Colour profile",
    });
    await user.click(combobox);
    fireEvent.pointerDown(document.body);
    expect(combobox.getAttribute("aria-expanded")).toBe("false");

    await user.click(combobox);
    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(combobox.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("ConnectionProfilesPanel", () => {
  it("rejects duplicate and built-in custom profile IDs before persisting", () => {
    const saveColorProfiles = useSettingsStore.getState().saveColorProfiles;

    expect(saveColorProfiles([{ ...customProfile, id: "red" }])).toBe(
      "Profile IDs must be unique and cannot use a built-in ID."
    );
    expect(
      saveColorProfiles([
        customProfile,
        { ...customProfile, name: "Night two" },
      ])
    ).toBe("Profile IDs must be unique and cannot use a built-in ID.");
    expect(useSettingsStore.getState().settings.connections.colorProfiles).toEqual(
      []
    );
  });

  it("associates validation errors and restores focus after saving", async () => {
    const user = userEvent.setup();
    render(<ConnectionProfilesPanel />);

    const addButton = screen.getByRole("button", { name: "+ Add Profile" });
    await user.click(addButton);
    const nameInput = screen.getByRole("textbox", { name: "Name" });
    expect(document.activeElement).toBe(nameInput);

    await user.click(screen.getByRole("button", { name: "Save Profile" }));
    expect(nameInput.getAttribute("aria-invalid")).toBe("true");
    expect(nameInput.getAttribute("aria-describedby")).toBe(
      screen.getByRole("alert").id
    );
    expect(document.activeElement).toBe(nameInput);

    await user.type(nameInput, "Night");
    await user.clear(screen.getByRole("textbox", { name: "Background" }));
    await user.type(
      screen.getByRole("textbox", { name: "Background" }),
      "#000000"
    );
    await user.clear(screen.getByRole("textbox", { name: "Foreground" }));
    await user.type(
      screen.getByRole("textbox", { name: "Foreground" }),
      "#FFFFFF"
    );
    await user.click(screen.getByRole("button", { name: "Save Profile" }));

    const preview = screen.getByText("Night");
    expect(preview.style.backgroundColor).toBe("rgb(0, 0, 0)");
    expect(preview.style.color).toBe("rgb(255, 255, 255)");
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "+ Add Profile" })
      )
    );
  });

  it("keeps the editor and store unchanged when localStorage fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is unavailable", "QuotaExceededError");
    });
    render(<ConnectionProfilesPanel />);

    await user.click(screen.getByRole("button", { name: "+ Add Profile" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Local");
    await user.click(screen.getByRole("button", { name: "Save Profile" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "Could not save settings"
    );
    expect(screen.getByRole("button", { name: "Save Profile" })).toBeTruthy();
    expect(
      useSettingsStore.getState().settings.connections.colorProfiles
    ).toEqual([]);
  });

  it("edits a profile without changing its stable ID", async () => {
    const user = userEvent.setup();
    resetStores([customProfile]);
    render(<ConnectionProfilesPanel />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const nameInput = screen.getByRole("textbox", { name: "Name" });
    await user.clear(nameInput);
    await user.type(nameInput, "Midnight");
    await user.click(screen.getByRole("button", { name: "Save Profile" }));

    expect(
      useSettingsStore.getState().settings.connections.colorProfiles
    ).toEqual([{ ...customProfile, id: "night", name: "Midnight" }]);
  });

  it("deletes a profile with no linked connections", async () => {
    const user = userEvent.setup();
    resetStores([customProfile]);
    connectionApi.connectionList.mockResolvedValue([]);
    render(<ConnectionProfilesPanel />);

    await confirmProfileDeletion(user);

    await waitFor(() =>
      expect(
        useSettingsStore.getState().settings.connections.colorProfiles
      ).toEqual([])
    );
    expect(connectionApi.connectionReassignColorProfile).toHaveBeenCalledWith(
      "night",
      "red"
    );
    expect(useConnectionStore.getState().connections).toEqual([]);
  });

  it("uses one atomic reassignment and disables repeat deletion", async () => {
    const user = userEvent.setup();
    let finishReassignment: (() => void) | undefined;
    connectionApi.connectionReassignColorProfile.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishReassignment = () => resolve({ updatedCount: 1 });
        })
    );
    connectionApi.connectionList.mockResolvedValue([
      { ...linkedConnection, colorProfileId: "red" },
    ]);
    resetStores([customProfile]);
    useConnectionStore.setState({ connections: [linkedConnection] });
    render(<ConnectionProfilesPanel />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("button", {
      name: "Delete Profile",
    });
    await user.click(confirm);

    expect(connectionApi.connectionReassignColorProfile).toHaveBeenCalledOnce();
    expect(connectionApi.connectionReassignColorProfile).toHaveBeenCalledWith(
      "night",
      "red"
    );
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    await user.click(confirm);
    expect(connectionApi.connectionReassignColorProfile).toHaveBeenCalledOnce();

    finishReassignment?.();
    await waitFor(() =>
      expect(
        useSettingsStore.getState().settings.connections.colorProfiles
      ).toEqual([])
    );
  });

  it("keeps the profile and surfaces an atomic reassignment failure", async () => {
    const user = userEvent.setup();
    connectionApi.connectionReassignColorProfile.mockRejectedValue(
      new Error("sidecar unavailable")
    );
    resetStores([customProfile]);
    useConnectionStore.setState({ connections: [linkedConnection] });
    render(<ConnectionProfilesPanel />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(
      await screen.findByRole("button", { name: "Delete Profile" })
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "The profile was not deleted"
    );
    expect(
      useSettingsStore.getState().settings.connections.colorProfiles
    ).toEqual([customProfile]);
  });

  it("keeps the profile after a post-reassignment storage failure and retries safely", async () => {
    const user = userEvent.setup();
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem")
      .mockImplementationOnce(() => {
        throw new DOMException("Storage is unavailable", "QuotaExceededError");
      })
      .mockImplementation(function (key: string, value: string) {
        originalSetItem.call(this, key, value);
      });
    const reassignedConnection = {
      ...linkedConnection,
      colorProfileId: "red",
    };
    resetStores([customProfile]);
    selectStoredConnection(linkedConnection);
    connectionApi.connectionList.mockResolvedValue([reassignedConnection]);
    render(<ConnectionProfilesPanel />);

    await confirmProfileDeletion(user);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Linked connections were reassigned to Red"
    );
    expect(
      useSettingsStore.getState().settings.connections.colorProfiles
    ).toEqual([customProfile]);
    expect(useConnectionStore.getState().selectedConnection?.colorProfileId).toBe(
      "red"
    );
    expect(useConnectionStore.getState().appearanceDraft.colorProfileId).toBe(
      "red"
    );

    await confirmProfileDeletion(user);

    await waitFor(() =>
      expect(
        useSettingsStore.getState().settings.connections.colorProfiles
      ).toEqual([])
    );
    expect(connectionApi.connectionReassignColorProfile).toHaveBeenCalledTimes(2);
  });

  it("keeps the profile and reports a connection refresh failure", async () => {
    const user = userEvent.setup();
    resetStores([customProfile]);
    selectStoredConnection(linkedConnection);
    connectionApi.connectionList.mockRejectedValueOnce(
      new Error("sidecar unavailable")
    );
    render(<ConnectionProfilesPanel />);

    await confirmProfileDeletion(user);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "refreshed connection list could not be loaded"
    );
    expect(
      useSettingsStore.getState().settings.connections.colorProfiles
    ).toEqual([customProfile]);
    expect(useConnectionStore.getState().error).toContain("sidecar unavailable");
  });

  it("cannot restore a deleted profile from a stale selected connection draft", async () => {
    const user = userEvent.setup();
    const reassignedConnection = {
      ...linkedConnection,
      colorProfileId: "red",
    };
    resetStores([customProfile]);
    selectStoredConnection(linkedConnection);
    connectionApi.connectionList.mockResolvedValue([reassignedConnection]);
    render(<ConnectionProfilesPanel />);

    await confirmProfileDeletion(user);
    await waitFor(() =>
      expect(
        useSettingsStore.getState().settings.connections.colorProfiles
      ).toEqual([])
    );

    const connectionState = useConnectionStore.getState();
    expect(connectionState.connections[0]?.colorProfileId).toBe("red");
    expect(connectionState.selectedConnection?.colorProfileId).toBe("red");
    expect(connectionState.appearanceDraft.colorProfileId).toBe("red");
    connectionState.openDialog({ refreshConnections: false });
    connectionState.setAppearanceDraft({ name: "Renamed production" });

    render(<PropertiesTab />);
    await user.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => expect(connectionApi.connectionSave).toHaveBeenCalled());
    expect(connectionApi.connectionSave.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        id: linkedConnection.id,
        name: "Renamed production",
        colorProfileId: "red",
      })
    );
  });
});

describe("ConnectionStringTab", () => {
  it("keeps parsed appearance changes dirty and saves them before connecting", async () => {
    const user = userEvent.setup();
    const storedConnection = {
      ...linkedConnection,
      colorProfileId: "red",
      connectionString: "Server=sql-old;Database=master;User Id=sa;",
    };
    resetStores([customProfile]);
    selectStoredConnection(storedConnection);
    useConnectionStore.getState().setAppearanceDraft({
      name: "Renamed production",
      colorProfileId: "night",
    });
    connectionApi.connectionList.mockImplementation(async () => [
      useConnectionStore.getState().selectedConnection,
    ]);

    const view = render(<ConnectionStringTab />);
    const connectionString = screen.getByRole("textbox", {
      name: "Connection String",
    });
    await user.clear(connectionString);
    await user.type(
      connectionString,
      "Server=sql-new;Database=app;User Id=sa;Encrypt=Strict;"
    );
    await user.click(
      screen.getByRole("button", { name: "Parse to Properties" })
    );

    expect(useConnectionStore.getState()).toEqual(
      expect.objectContaining({
        formDirty: true,
        dialogTab: "properties",
        appearanceDraft: {
          name: "Renamed production",
          colorProfileId: "night",
        },
      })
    );
    expect(useConnectionStore.getState().selectedConnection).toEqual(
      expect.objectContaining({
        id: storedConnection.id,
        serverName: "sql-new",
        name: "Renamed production",
        colorProfileId: "night",
      })
    );

    view.unmount();
    render(<PropertiesTab />);
    await user.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => expect(connectionApi.connectionSave).toHaveBeenCalled());
    expect(connectionApi.connectionSave.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        id: storedConnection.id,
        name: "Renamed production",
        colorProfileId: "night",
        serverName: "sql-new",
      })
    );
  });
});

describe("SettingsDialog", () => {
  it("finds custom profiles and uses ordinary category navigation", async () => {
    const user = userEvent.setup();
    resetStores([customProfile]);
    render(<SettingsDialog open onClose={vi.fn()} />);

    const search = screen.getByRole("textbox", { name: "Search settings" });
    await user.type(search, "Night");
    expect(screen.getByTestId("connection-profiles-settings")).toBeTruthy();
    expect(screen.getByText("Night")).toBeTruthy();
    expect(screen.queryByRole("tab")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Connections" }));
    expect((search as HTMLInputElement).value).toBe("");
    expect(
      screen
        .getByRole("button", { name: "Connections" })
        .getAttribute("aria-current")
    ).toBe("page");
  });
});

describe("ConfirmDialog", () => {
  it("stays in its native dialog subtree and restores trigger focus", async () => {
    const user = userEvent.setup();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();

    const view = render(
      <dialog open>
        <ConfirmDialog
          open
          title="Delete profile"
          message="Delete this profile?"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </dialog>
    );

    const dialogs = screen.getAllByRole("dialog");
    const confirmation = dialogs.find(
      (dialog) => dialog.getAttribute("aria-describedby") !== null
    );
    expect(confirmation?.parentElement?.tagName).toBe("DIALOG");
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Cancel" })
      )
    );

    view.rerender(
      <dialog open>
        <ConfirmDialog
          open={false}
          title="Delete profile"
          message="Delete this profile?"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </dialog>
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    trigger.remove();
    await user.keyboard("{Escape}");
  });
});
