import { useEffect, useState } from "react";
import { api } from "./api.js";

export default function useRemote(path) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  useEffect(() => {
    let active = true;
    api(path)
      .then((data) => {
        if (active) setResult({ path, revision, data });
      })
      .catch((error) => {
        if (active) setResult({ path, revision, error });
      });
    return () => {
      active = false;
    };
  }, [path, revision]);
  const current = result?.path === path && result?.revision === revision;
  return {
    ...(current ? result : {}),
    loading: !current,
    refresh: () => setRevision((value) => value + 1),
  };
}
