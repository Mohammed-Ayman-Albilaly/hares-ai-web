import {
  CATEGORY_CODES,
  LOG_ACTIONS,
  PLATFORMS,
  RISK_LEVELS,
  USER_DECISIONS,
} from "@hares/contract";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { I } from "@/components/ui/icons";
import { Card, FilterBar } from "@/components/ui/layout";
import { SelectField } from "@/components/ui/SelectField";
import { DataState, EmptyState, TableSkeleton } from "@/components/ui/states";
import { useLang } from "@/i18n/useLang";
import { formatNumber } from "@/components/charts/direction";
import { useLogs, type LogFilterValues } from "./hooks";
import { LogTable } from "./LogTable";

interface RawFilters {
  fromDay: string;
  toDay: string;
  risk_level: string;
  platform: string;
  action: string;
  user_decision: string;
  category: string;
}
const EMPTY: RawFilters = {
  fromDay: "",
  toDay: "",
  risk_level: "",
  platform: "",
  action: "",
  user_decision: "",
  category: "",
};

/** Local midnight of a yyyy-mm-dd day, as the ISO instant the API expects. */
const dayStart = (day: string, plusDays = 0) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d! + plusDays).toISOString();
};

interface Props {
  /** List endpoint, e.g. `/logs/mine` or `/admin/logs`. */
  base: string;
  /** Filters the user cannot change (e.g. `action: 'BLOCKED'` on the Blocked page). */
  fixed?: LogFilterValues;
  showUser?: boolean;
  /** Hide the action filter (pages that fix the action). */
  hideActionFilter?: boolean;
  /** Extra filter controls (e.g. user or department selects for administrators). */
  extraFilters?: ReactNode;
  extraValues?: LogFilterValues;
  /** Texts for the empty state when the account has no events at all. */
  emptyTitle: string;
  emptyBody: string;
}

/**
 * Filter bar + table + paging, shared by every log screen (user, department,
 * organisation). Handles the four states: loading, error with retry, empty
 * (no events / no match) and populated.
 */
export function LogsView({
  base,
  fixed = {},
  showUser,
  hideActionFilter,
  extraFilters,
  extraValues = {},
  emptyTitle,
  emptyBody,
}: Props) {
  const { t } = useTranslation();
  const lang = useLang();
  const [f, setF] = useState<RawFilters>(EMPTY);
  const set =
    (k: keyof RawFilters) =>
    (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
      setF((p) => ({ ...p, [k]: e.target.value }));

  const filters = useMemo<LogFilterValues>(
    () => ({
      ...(f.fromDay ? { from: dayStart(f.fromDay) } : {}),
      ...(f.toDay ? { to: dayStart(f.toDay, 1) } : {}),
      ...(f.risk_level ? { risk_level: f.risk_level } : {}),
      ...(f.platform ? { platform: f.platform } : {}),
      ...(f.action ? { action: f.action } : {}),
      ...(f.user_decision ? { user_decision: f.user_decision } : {}),
      ...(f.category ? { category: f.category } : {}),
      ...extraValues,
      ...fixed,
    }),
    [f, JSON.stringify(extraValues), JSON.stringify(fixed)],
  );

  const rangeInvalid = Boolean(f.fromDay && f.toDay && f.fromDay > f.toDay);
  // An inverted range is explained on screen and never sent to the server.
  const { query, page, hasPrev, hasNext, goNext, goPrev } = useLogs(
    base,
    filters,
    25,
    !rangeInvalid,
  );
  const filtered =
    Object.keys(filters).length >
    Object.keys(fixed).length + Object.keys(extraValues).length;
  const items = query.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <div className="field">
          <label htmlFor="f-from">{t("logs.from")}</label>
          <input
            id="f-from"
            type="date"
            value={f.fromDay}
            max={f.toDay || undefined}
            onChange={set("fromDay")}
          />
        </div>
        <div className="field">
          <label htmlFor="f-to">{t("logs.to")}</label>
          <input
            id="f-to"
            type="date"
            value={f.toDay}
            min={f.fromDay || undefined}
            aria-invalid={rangeInvalid || undefined}
            aria-describedby={rangeInvalid ? "f-range-err" : undefined}
            onChange={set("toDay")}
          />
        </div>
        <SelectField
          label={t("logs.platform")}
          value={f.platform}
          onChange={set("platform")}
        >
          <option value="">{t("logs.all")}</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {t(`platform.${p}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t("logs.risk")}
          value={f.risk_level}
          onChange={set("risk_level")}
        >
          <option value="">{t("logs.all")}</option>
          {RISK_LEVELS.map((r) => (
            <option key={r} value={r}>
              {t(`risk.${r}`)}
            </option>
          ))}
        </SelectField>
        {!hideActionFilter && (
          <SelectField
            label={t("logs.action")}
            value={f.action}
            onChange={set("action")}
          >
            <option value="">{t("logs.all")}</option>
            {LOG_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {t(`action.${a}`)}
              </option>
            ))}
          </SelectField>
        )}
        <SelectField
          label={t("logs.decision")}
          value={f.user_decision}
          onChange={set("user_decision")}
        >
          <option value="">{t("logs.all")}</option>
          {USER_DECISIONS.map((d) => (
            <option key={d} value={d}>
              {t(`decision.${d}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t("logs.category")}
          value={f.category}
          onChange={set("category")}
        >
          <option value="">{t("logs.all")}</option>
          {CATEGORY_CODES.map((c) => (
            <option key={c} value={c}>
              {t(`category.${c}`)}
            </option>
          ))}
        </SelectField>
        {extraFilters}
        <Button
          variant="ghost"
          className="self-end"
          onClick={() => setF(EMPTY)}
          disabled={!filtered}
        >
          <I.X size={14} /> {t("logs.clear")}
        </Button>
        {rangeInvalid && (
          <div id="f-range-err" className="err w-full" role="alert">
            {t("logs.rangeInvalid")}
          </div>
        )}
      </FilterBar>

      {!rangeInvalid && (
        <DataState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          refetch={() => void query.refetch()}
          isEmpty={items.length === 0}
          skeleton={<TableSkeleton rows={8} />}
          empty={
            filtered ? (
              <EmptyState
                title={t("logs.noResults")}
                body={t("logs.noResultsBody")}
                action={
                  <Button onClick={() => setF(EMPTY)}>{t("logs.clear")}</Button>
                }
              />
            ) : (
              <EmptyState title={emptyTitle} body={emptyBody} />
            )
          }
        >
          <Card padded={false}>
            <LogTable
              items={items}
              showUser={showUser}
              busy={query.isFetching && query.isPlaceholderData}
            />
            <nav
              className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[12.5px] text-ink-4"
              aria-label={t("logs.pagination")}
            >
              <div aria-live="polite">
                {t("logs.pageInfo", {
                  page: formatNumber(page, lang),
                  count: formatNumber(items.length, lang),
                })}
              </div>
              <div className="flex gap-2">
                <Button
                  small
                  variant="ghost"
                  onClick={goPrev}
                  disabled={!hasPrev}
                >
                  {t("logs.prev")}
                </Button>
                <Button
                  small
                  variant="ghost"
                  onClick={goNext}
                  disabled={!hasNext}
                >
                  {t("logs.next")}
                </Button>
              </div>
            </nav>
          </Card>
        </DataState>
      )}
    </div>
  );
}
