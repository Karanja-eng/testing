import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Route,
  Switch,
  NavLink,
} from "react-router-dom";
import DesignSlabs from "./DesignSlabs";
import DesignColumns from "./DesignColumns";
import DesignBeams from "./DesignBeams";
import DesignFoundations from "./DesignFoundations";

const Design = () => {
  const [activeTab, setActiveTab] = useState("slabs");

  return (
    <Router>
      <div className="design-container">
        <h2 className="title">Design Members</h2>
        <div className="tabs">
          <NavLink
            to="/design/slabs"
            activeClassName="active"
            onClick={() => setActiveTab("slabs")}
          >
            Design Slabs
          </NavLink>
          <NavLink
            to="/design/columns"
            activeClassName="active"
            onClick={() => setActiveTab("columns")}
          >
            Design Columns
          </NavLink>
          <NavLink
            to="/design/beams"
            activeClassName="active"
            onClick={() => setActiveTab("beams")}
          >
            Design Beams
          </NavLink>
          <NavLink
            to="/design/foundations"
            activeClassName="active"
            onClick={() => setActiveTab("foundations")}
          >
            Design Foundations
          </NavLink>
        </div>
        <Switch>
          <Route path="/design/slabs" component={DesignSlabs} />
          <Route path="/design/columns" component={DesignColumns} />
          <Route path="/design/beams" component={DesignBeams} />
          <Route path="/design/foundations" component={DesignFoundations} />
        </Switch>
      </div>
    </Router>
  );
};

export default Design;
