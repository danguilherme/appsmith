/* eslint-disable cypress/no-unnecessary-waiting */

const widgetsPage = require("../../../../locators/Widgets.json");
const testdata = require("../../../../fixtures/testdata.json");
import * as _ from "../../../../support/Objects/ObjectsCore";

describe("Table Widget V2 property pane feature validation", function () {
  before(() => {
    _.agHelper.AddDsl("tableV2NewDsl");
  });

  it("1. Table widget V2 toggle test for text alignment", function () {
    _.entityExplorer.SelectEntityByName("Table1");
    cy.editColumn("id");
    cy.moveToStyleTab();
    _.agHelper.Sleep();
    _.propPane.EnterJSContext("Text align", testdata.bindingAlign);
    cy.readTableV2dataValidateCSS("0", "0", "justify-content", "flex-start");
    cy.readTableV2dataValidateCSS("1", "0", "justify-content", "flex-end");
  });

  it("2. Table widget V2 change text size and validate", function () {
    cy.readTableV2dataValidateCSS("0", "0", "font-size", "14px");
    //cy.movetoStyleTab();
    cy.get(widgetsPage.textSize).last().click({ force: true });
    _.agHelper.Sleep();
    cy.selectTxtSize("XL");
    cy.readTableV2dataValidateCSS("0", "0", "font-size", "30px");
  });

  it("3. Table widget toggle test for vertical Alignment", function () {
    //cy.movetoStyleTab();
    _.agHelper.Sleep();
    _.propPane.EnterJSContext(
      "Vertical alignment",
      testdata.bindingVerticalAlig,
    );
    cy.readTableV2dataValidateCSS("0", "0", "align-items", "flex-start");
    cy.readTableV2dataValidateCSS("1", "0", "align-items", "flex-end");
  });

  it("4. Table widget toggle test for text size", function () {
    //cy.movetoStyleTab();
    _.agHelper.Sleep();
    _.propPane.EnterJSContext("Text size", testdata.bindingNewSize);
    cy.readTableV2dataValidateCSS("0", "0", "font-size", "14px");
    cy.readTableV2dataValidateCSS("1", "0", "font-size", "24px");
  });

  it("5. Table widget V2 toggle test for style Alignment", function () {
    _.agHelper.Sleep();
    _.propPane.EnterJSContext("Emphasis", testdata.bindingStyle);
    cy.readTableV2dataValidateCSS("0", "0", "font-style", "normal");
    cy.readTableV2dataValidateCSS("1", "0", "font-style", "italic");
  });

  it("6. Table widget toggle test for text color", function () {
    cy.moveToStyleTab();
    _.agHelper.Sleep();
    _.propPane.EnterJSContext("Text color", testdata.bindingTextColor);
    cy.readTableV2dataValidateCSS("0", "0", "color", "rgb(0, 128, 0)");
    cy.readTableV2dataValidateCSS("1", "0", "color", "rgb(255, 0, 0)");
  });

  it("7. Table widget toggle test for background color", function () {
    cy.moveToStyleTab();
    _.agHelper.Sleep();
    _.propPane.EnterJSContext("Cell Background", testdata.bindingTextColor);
    cy.readTableV2dataValidateCSS(
      "0",
      "0",
      "background",
      "rgb(0, 128, 0) none repeat scroll 0% 0% / auto padding-box border-box",
    );
    cy.readTableV2dataValidateCSS(
      "1",
      "0",
      "background",
      "rgb(255, 0, 0) none repeat scroll 0% 0% / auto padding-box border-box",
    );
  });
});
