import type { ReduxAction } from "@appsmith/constants/ReduxActionConstants";
import {
  ReduxActionErrorTypes,
  ReduxActionTypes,
} from "@appsmith/constants/ReduxActionConstants";
import { all, call, put, select, take, takeLatest } from "redux-saga/effects";
import {
  getWidgetIdsByType,
  getWidgetImmediateChildren,
  getWidgets,
} from "./selectors";
import type {
  SetSelectedWidgetsPayload,
  WidgetSelectionRequestPayload,
} from "actions/widgetSelectionActions";
import {
  setEntityExplorerAncestry,
  setSelectedWidgetAncestry,
  setSelectedWidgets,
} from "actions/widgetSelectionActions";
import { getLastSelectedWidget, getSelectedWidgets } from "selectors/ui";
import type { CanvasWidgetsReduxState } from "reducers/entityReducers/canvasWidgetsReducer";
import { showModal } from "actions/widgetActions";
import history, { NavigationMethod } from "utils/history";
import {
  getCurrentPageId,
  getIsEditorInitialized,
  getIsFetchingPage,
  snipingModeSelector,
} from "selectors/editorSelectors";
import { builderURL, widgetURL } from "@appsmith/RouteBuilder";
import {
  getAppMode,
  getCanvasWidgets,
} from "@appsmith/selectors/entitiesSelector";
import type { SetSelectionResult } from "sagas/WidgetSelectUtils";
import {
  assertParentId,
  isInvalidSelectionRequest,
  pushPopWidgetSelection,
  selectAllWidgetsInCanvasSaga,
  SelectionRequestType,
  selectMultipleWidgets,
  selectOneWidget,
  getWidgetAncestry,
  shiftSelectWidgets,
  unselectWidget,
} from "sagas/WidgetSelectUtils";
import { quickScrollToWidget } from "utils/helpers";
import { areArraysEqual } from "utils/AppsmithUtils";
import { APP_MODE } from "entities/App";

// The following is computed to be used in the entity explorer
// Every time a widget is selected, we need to expand widget entities
// in the entity explorer so that the selected widget is visible
function* selectWidgetSaga(action: ReduxAction<WidgetSelectionRequestPayload>) {
  try {
    const {
      invokedBy,
      pageId,
      payload = [],
      selectionRequestType,
    } = action.payload;

    if (payload.some(isInvalidSelectionRequest)) {
      // Throw error
      return;
    }

    let newSelection: SetSelectionResult;

    const allWidgets: CanvasWidgetsReduxState = yield select(getWidgets);
    const selectedWidgets: string[] = yield select(getSelectedWidgets);
    const lastSelectedWidget: string = yield select(getLastSelectedWidget);

    // It is possible that the payload is empty.
    // These properties can be used for a finding sibling widgets for certain types of selections
    const widgetId = payload[0];
    const parentId: string | undefined =
      widgetId in allWidgets ? allWidgets[widgetId].parentId : undefined;

    if (
      widgetId &&
      !allWidgets[widgetId] &&
      selectionRequestType === SelectionRequestType.One
    ) {
      return;
    }

    switch (selectionRequestType) {
      case SelectionRequestType.Empty: {
        newSelection = [];
        break;
      }
      case SelectionRequestType.UnsafeSelect: {
        newSelection = payload;
        break;
      }
      case SelectionRequestType.One: {
        assertParentId(parentId);
        newSelection = selectOneWidget(payload);
        break;
      }
      case SelectionRequestType.Multiple: {
        newSelection = selectMultipleWidgets(payload, allWidgets);
        break;
      }
      case SelectionRequestType.ShiftSelect: {
        assertParentId(parentId);
        const siblingWidgets: string[] = yield select(
          getWidgetImmediateChildren,
          parentId,
        );
        newSelection = shiftSelectWidgets(
          payload,
          siblingWidgets,
          selectedWidgets,
          lastSelectedWidget,
        );
        break;
      }
      case SelectionRequestType.PushPop: {
        assertParentId(parentId);
        const siblingWidgets: string[] = yield select(
          getWidgetImmediateChildren,
          parentId,
        );
        newSelection = pushPopWidgetSelection(
          payload,
          selectedWidgets,
          siblingWidgets,
        );
        break;
      }
      case SelectionRequestType.Unselect: {
        newSelection = unselectWidget(payload, selectedWidgets);
        break;
      }
      case SelectionRequestType.All: {
        newSelection = yield call(selectAllWidgetsInCanvasSaga);
      }
    }

    if (!newSelection) return;

    // When append selections happen, we want to ensure they all exist under the same parent
    // Selections across parents is not possible.
    if (
      [SelectionRequestType.PushPop, SelectionRequestType.ShiftSelect].includes(
        selectionRequestType,
      ) &&
      newSelection[0] in allWidgets
    ) {
      const selectionWidgetId = newSelection[0];
      const parentId = allWidgets[selectionWidgetId].parentId;
      if (parentId) {
        const selectionSiblingWidgets: string[] = yield select(
          getWidgetImmediateChildren,
          parentId,
        );
        newSelection = newSelection.filter((each) =>
          selectionSiblingWidgets.includes(each),
        );
      }
    }

    if (areArraysEqual([...newSelection], [...selectedWidgets])) {
      yield put(setSelectedWidgets(newSelection));
      return;
    }
    yield call(appendSelectedWidgetToUrlSaga, newSelection, pageId, invokedBy);
  } catch (error) {
    yield put({
      type: ReduxActionErrorTypes.WIDGET_SELECTION_ERROR,
      payload: {
        action: ReduxActionTypes.SELECT_WIDGET_INIT,
        error,
      },
    });
  }
}

/**
 * Append Selected widgetId as hash to the url path
 * @param selectedWidgets
 * @param pageId
 * @param invokedBy
 */
function* appendSelectedWidgetToUrlSaga(
  selectedWidgets: string[],
  pageId?: string,
  invokedBy?: NavigationMethod,
) {
  const isSnipingMode: boolean = yield select(snipingModeSelector);
  const appMode: APP_MODE = yield select(getAppMode);
  const viewMode = appMode === APP_MODE.PUBLISHED;
  if (isSnipingMode || viewMode) return;
  const { pathname } = window.location;
  const currentPageId: string = yield select(getCurrentPageId);
  const currentURL = pathname;
  const newUrl = selectedWidgets.length
    ? widgetURL({
        pageId: pageId ?? currentPageId,
        persistExistingParams: true,
        selectedWidgets,
      })
    : builderURL({
        pageId: pageId ?? currentPageId,
        persistExistingParams: true,
      });
  if (currentURL !== newUrl) {
    history.push(newUrl, { invokedBy });
  }
}

function* waitForInitialization(saga: any, action: ReduxAction<unknown>) {
  const isEditorInitialized: boolean = yield select(getIsEditorInitialized);
  const appMode: APP_MODE = yield select(getAppMode);
  const isViewMode = appMode === APP_MODE.PUBLISHED;

  // Wait until the editor is initialised, and ensure we're not in the view mode
  if (!isEditorInitialized && !isViewMode) {
    yield take(ReduxActionTypes.INITIALIZE_EDITOR_SUCCESS);
  }

  // Wait until we're done fetching the page
  // This is so that we can reliably assume that the Editor and the Canvas have loaded
  const isPageFetching: boolean = yield select(getIsFetchingPage);
  if (isPageFetching) {
    yield take(ReduxActionTypes.FETCH_PAGE_SUCCESS);
  }

  // Continue yielding
  yield call(saga, action);
}

function* handleWidgetSelectionSaga(
  action: ReduxAction<SetSelectedWidgetsPayload>,
) {
  yield call(focusOnWidgetSaga, action);
  yield call(openOrCloseModalSaga, action);
  yield call(setWidgetAncestry, action);
}

function* openOrCloseModalSaga(action: ReduxAction<{ widgetIds: string[] }>) {
  if (action.payload.widgetIds.length !== 1) return;

  // Let's assume that the payload widgetId is a modal widget and we need to open the modal as it is selected
  let modalWidgetToOpen: string = action.payload.widgetIds[0];

  // Get all modal widget ids
  const modalWidgetIds: string[] = yield select(
    getWidgetIdsByType,
    "MODAL_WIDGET",
  );

  // Get all widgets
  const allWidgets: CanvasWidgetsReduxState = yield select(getWidgets);
  // Get the ancestry of the selected widget
  const widgetAncestry = getWidgetAncestry(modalWidgetToOpen, allWidgets);

  // If the selected widget is a modal, we want to open the modal
  const widgetIsModal =
    // Check if the widget is a modal widget
    modalWidgetIds.includes(modalWidgetToOpen);

  // Let's assume that this is not a child of a modal widget
  let widgetIsChildOfModal = false;

  if (!widgetIsModal) {
    // Check if the widget is a child of a modal widget
    const indexOfParentModalWidget: number = widgetAncestry.findIndex((id) =>
      modalWidgetIds.includes(id),
    );
    // If we found a modal widget in the ancestry, we want to open that modal
    if (indexOfParentModalWidget > -1) {
      // Set the flag to true, so that we can open the modal
      widgetIsChildOfModal = true;
      modalWidgetToOpen = widgetAncestry[indexOfParentModalWidget];
    }
  }

  if (widgetIsModal || widgetIsChildOfModal) {
    yield put(showModal(modalWidgetToOpen));
  }
}

function* focusOnWidgetSaga(action: ReduxAction<{ widgetIds: string[] }>) {
  if (action.payload.widgetIds.length > 1) return;
  const widgetId = action.payload.widgetIds[0];
  if (widgetId) {
    const allWidgets: CanvasWidgetsReduxState = yield select(getCanvasWidgets);
    quickScrollToWidget(widgetId, allWidgets);
  }
}

function* setWidgetAncestry(action: ReduxAction<SetSelectedWidgetsPayload>) {
  const allWidgets: CanvasWidgetsReduxState = yield select(getWidgets);

  // When a widget selection is triggered via a canvas click,
  // we do not want to set the widget ancestry. This is so
  // that if the widget like a button causes a widget
  // navigation, it would block the navigation
  const dontSetSelectedAncestry =
    action.payload.invokedBy === undefined ||
    action.payload.invokedBy === NavigationMethod.CanvasClick;

  const widgetAncestry = getWidgetAncestry(
    action.payload.widgetIds[0],
    allWidgets,
  );

  if (dontSetSelectedAncestry) {
    yield put(setSelectedWidgetAncestry([]));
  } else {
    yield put(setSelectedWidgetAncestry(widgetAncestry));
  }
  yield put(setEntityExplorerAncestry(widgetAncestry));
}

export function* widgetSelectionSagas() {
  yield all([
    takeLatest(ReduxActionTypes.SELECT_WIDGET_INIT, selectWidgetSaga),
    takeLatest(
      ReduxActionTypes.SET_SELECTED_WIDGETS,
      waitForInitialization,
      handleWidgetSelectionSaga,
    ),
  ]);
}
