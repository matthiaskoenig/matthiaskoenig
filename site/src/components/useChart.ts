// Shared ECharts setup for the chart islands: only the used chart types and
// components are registered, so the browser bundle stays small.
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { init, use, type EChartsCoreOption, type ECharts } from 'echarts/core';
import { BarChart, ScatterChart } from 'echarts/charts';
import { DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

use([BarChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, SVGRenderer]);

export const palette = ['#2c3e50', '#18bc9c', '#3498db', '#f39c12', '#e74c3c', '#95a5a6', '#8e44ad', '#16a085'];

export function useChart(option: () => EChartsCoreOption, onClick?: (params: unknown) => void): Ref<HTMLDivElement | null> {
  const el = ref<HTMLDivElement | null>(null);
  let chart: ECharts | null = null;
  const resize = () => chart?.resize();
  onMounted(() => {
    if (!el.value) return;
    chart = init(el.value, undefined, { renderer: 'svg' });
    chart.setOption(option());
    if (onClick) chart.on('click', onClick);
    window.addEventListener('resize', resize);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('resize', resize);
    chart?.dispose();
  });
  return el;
}
