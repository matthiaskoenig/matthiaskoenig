// Shared ECharts setup for the chart islands: only the used chart types and
// components are registered, so the browser bundle stays small.
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { init, use, type EChartsCoreOption, type ECharts } from 'echarts/core';
import { BarChart, ScatterChart } from 'echarts/charts';
import { DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

use([BarChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, SVGRenderer]);


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
